import { act, renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '@/core/query/queryKeys';

import type { Page } from '@/core/domain/Page';
import type { KeypadKey } from '../../../domain/keypad';
import type { Transaction } from '../../../domain/Transaction';
import { TransactionError } from '../../../domain/TransactionError';
import {
  ANA,
  ME,
  createTransactionsTestKit,
  householdOf,
} from '../../../testing/transactionsTestKit';
import { useAddTransactionViewModel } from '../useAddTransactionViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

async function setup(options: Parameters<typeof createTransactionsTestKit>[0] = {}) {
  const kit = createTransactionsTestKit(options);
  const hook = await renderHook(() => useAddTransactionViewModel(), { wrapper: kit.Wrapper });
  // The categories load asynchronously (TanStack notifies on a timer).
  await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
  return { ...kit, hook };
}

type Hook = Awaited<ReturnType<typeof setup>>['hook'];

async function typeKeys(hook: Hook, keys: string) {
  for (const key of keys) {
    await act(async () =>
      hook.result.current.pressKey((key === '<' ? 'delete' : key) as KeypadKey),
    );
  }
}

function ready(hook: Hook) {
  const { state } = hook.result.current;
  if (state.status !== 'ready') throw new Error('expected ready');
  return state;
}

describe('useAddTransactionViewModel', () => {
  it('starts as an empty expense with the first expense category selected', async () => {
    const { hook } = await setup();
    const state = ready(hook);
    expect(state).toMatchObject({
      type: 'expense',
      amount: '0',
      currencySymbol: '€',
      dayOffset: 0,
      canShare: false,
      shared: false,
      canSave: false,
      error: null,
    });
    expect(state.categories[0]).toMatchObject({ id: 'food', selected: true });
    expect(state.categories.map((c) => c.id)).not.toContain('salary');
  });

  it('is loading until the household is known', async () => {
    const kit = createTransactionsTestKit();
    kit.queryClient.removeQueries({ queryKey: queryKeys.households.mine() });
    // With no household cached the query would refetch an empty list: no active household.
    const hook = await renderHook(() => useAddTransactionViewModel(), { wrapper: kit.Wrapper });
    expect(hook.result.current.state.status).toBe('loading');
  });

  it('shows what is typed with thousands separators and enables saving only above zero', async () => {
    const { hook } = await setup();
    await typeKeys(hook, '0');
    expect(ready(hook).canSave).toBe(false);
    await typeKeys(hook, '<1234,5');
    expect(ready(hook).amount).toBe('1.234,5');
    expect(ready(hook).canSave).toBe(true);
    await typeKeys(hook, '<<<<<<<');
    expect(ready(hook).amount).toBe('0');
    expect(ready(hook).canSave).toBe(false);
  });

  it('switching to income swaps the categories and drops an incompatible choice', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.selectCategory('leisure' as never));
    expect(ready(hook).categories.find((c) => c.selected)?.id).toBe('leisure');

    await act(async () => hook.result.current.setType('income'));
    const income = ready(hook);
    expect(income.categories.map((c) => c.id)).toContain('salary');
    expect(income.categories.map((c) => c.id)).not.toContain('food');
    expect(income.categories.find((c) => c.selected)?.id).toBe('salary');

    await act(async () => hook.result.current.setType('expense'));
    // Coming back, the earlier choice fits again and is still the one selected.
    expect(ready(hook).categories.find((c) => c.selected)?.id).toBe('leisure');
  });

  it('saves, defaulting to today and to the signed-in member, and tells the View to close', async () => {
    const { hook, repository } = await setup();
    await typeKeys(hook, '12,5');
    await act(async () => hook.result.current.setDescription('  Menú   del día '));

    let ok = false;
    await act(async () => {
      ok = await hook.result.current.submit();
    });
    expect(ok).toBe(true);

    const page = await repository.list('h1', {}, {});
    expect(page.items).toHaveLength(1);
    const saved = page.items[0] as Transaction;
    expect(saved).toMatchObject({
      type: 'expense',
      categoryId: 'food',
      description: 'Menú del día',
      payerId: ME,
      shared: false,
    });
    expect(saved.amount.amountMinor).toBe(1_250);
    const today = new Date();
    expect(saved.occurredAt).toEqual(
      new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    );
  });

  it('"Ayer" saves yesterday', async () => {
    const { hook, repository } = await setup();
    await typeKeys(hook, '3');
    await act(async () => hook.result.current.setDay(-1));
    await act(async () => void (await hook.result.current.submit()));

    const [saved] = (await repository.list('h1', {}, {})).items;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(saved?.occurredAt).toEqual(
      new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
    );
  });

  it('saves an income with the income category', async () => {
    const { hook, repository } = await setup();
    await act(async () => hook.result.current.setType('income'));
    await typeKeys(hook, '1500');
    await act(async () => void (await hook.result.current.submit()));
    const [saved] = (await repository.list('h1', {}, {})).items;
    expect(saved).toMatchObject({ type: 'income', categoryId: 'salary' });
    expect(saved?.amount.amountMinor).toBe(150_000);
  });

  it('does nothing when the amount is zero', async () => {
    const { hook, repository } = await setup();
    const create = jest.spyOn(repository, 'create');
    let ok = true;
    await act(async () => {
      ok = await hook.result.current.submit();
    });
    expect(ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the movement at the top of the cached lists BEFORE the server answers', async () => {
    const kit = await setup();
    const key = queryKeys.transactions.list('h1', {});
    const empty: Page<Transaction> = { items: [], nextCursor: null };
    kit.queryClient.setQueryData(key, empty);

    let release: () => void = () => undefined;
    jest.spyOn(kit.repository, 'create').mockImplementation(
      (input) =>
        new Promise((resolve) => {
          release = () =>
            resolve({ ...input, id: input.id ?? 'x', payerId: ME, shares: [] } as Transaction);
        }),
    );
    await typeKeys(kit.hook, '7');

    let pending: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      pending = kit.hook.result.current.submit();
    });
    const during = kit.queryClient.getQueryData<Page<Transaction>>(key);
    expect(during?.items).toHaveLength(1);
    expect(during?.items[0]?.amount.amountMinor).toBe(700);
    expect(ready(kit.hook).saving).toBe(true);
    expect(ready(kit.hook).canSave).toBe(false); // no double tap

    await act(async () => {
      release();
      await pending;
    });
    // "Saving" lasts until the lists have been refreshed with the server's truth.
    await waitFor(() => expect(ready(kit.hook).saving).toBe(false));
  });

  it('rolls the list back and shows the reason when the server refuses', async () => {
    const kit = await setup();
    const key = queryKeys.transactions.list('h1', {});
    kit.queryClient.setQueryData(key, { items: [], nextCursor: null });
    jest.spyOn(kit.repository, 'create').mockRejectedValue(new TransactionError('network'));
    await typeKeys(kit.hook, '7');

    let ok = true;
    await act(async () => {
      ok = await kit.hook.result.current.submit();
    });
    expect(ok).toBe(false);
    expect(ready(kit.hook).error).toContain('conexión');
    expect(kit.queryClient.getQueryData<Page<Transaction>>(key)?.items).toHaveLength(0);
    // Typing again clears the message.
    await typeKeys(kit.hook, '1');
    expect(ready(kit.hook).error).toBeNull();
  });

  it('limits the note to 80 characters', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.setDescription('x'.repeat(200)));
    expect(ready(hook).description).toHaveLength(80);
  });

  describe('in a shared household', () => {
    const shared = householdOf('shared', true);

    it('offers payers and the "shared" switch, with the signed-in member preselected', async () => {
      const { hook } = await setup({ household: shared });
      const state = ready(hook);
      expect(state.canShare).toBe(true);
      expect(state.payers).toEqual([
        { id: ME, label: 'Leo', selected: true },
        { id: ANA, label: 'Ana', selected: false },
      ]);
    });

    it('saves the chosen payer and the shared flag', async () => {
      const { hook, repository } = await setup({ household: shared });
      await typeKeys(hook, '40');
      await act(async () => hook.result.current.selectPayer(ANA));
      await act(async () => hook.result.current.setShared(true));
      expect(ready(hook)).toMatchObject({ shared: true });
      expect(ready(hook).payers.find((p) => p.selected)?.id).toBe(ANA);

      await act(async () => void (await hook.result.current.submit()));
      const [saved] = (await repository.list('h1', {}, {})).items;
      expect(saved).toMatchObject({ payerId: ANA, shared: true });
    });

    it('a shared household with only me in it cannot share yet', async () => {
      const { hook } = await setup({ household: householdOf('shared', false) });
      expect(ready(hook)).toMatchObject({ canShare: false, shared: false, payers: [] });
    });
  });
});

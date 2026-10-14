import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';

import type { CategoryId, Transaction } from '../../../domain/Transaction';
import { TransactionError } from '../../../domain/TransactionError';
import {
  ANA,
  ME,
  createTransactionsTestKit,
  householdOf,
} from '../../../testing/transactionsTestKit';
import { useTransactionDetailViewModel } from '../useTransactionDetailViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 14, 10),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
    ],
  });
});
afterEach(() => jest.useRealTimers());

const baseTx = (extra: Partial<Transaction> = {}): Transaction => ({
  id: 'tx1',
  type: 'expense',
  amount: Money.ofMinor(1_250, 'EUR'),
  categoryId: 'food' as CategoryId,
  description: 'Menú del día',
  occurredAt: new Date(2026, 9, 12),
  householdId: 'h1',
  payerId: ME,
  shared: false,
  shares: [],
  ...extra,
});

async function setup(
  tx: Transaction | null = baseTx(),
  household = householdOf('personal'),
  idOverride?: { value: string | undefined },
) {
  const id = idOverride ? idOverride.value : 'tx1';
  const kit = createTransactionsTestKit({
    household,
    memory: { transactions: tx ? [tx] : [] },
  });
  const hook = await renderHook(() => useTransactionDetailViewModel(id), { wrapper: kit.Wrapper });
  await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
  return { ...kit, hook };
}

type Hook = Awaited<ReturnType<typeof setup>>['hook'];
function ready(hook: Hook) {
  const { state } = hook.result.current;
  if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
  return state;
}

describe('useTransactionDetailViewModel', () => {
  describe('reading', () => {
    it('shows the movement ready to print', async () => {
      const { hook } = await setup();
      const state = ready(hook);
      expect(state).toMatchObject({
        mode: 'view',
        type: 'expense',
        typeLabel: 'Gasto',
        categoryName: 'Comida',
        description: 'Menú del día',
        shared: false,
        busy: false,
        error: null,
        edit: null,
      });
      expect(state.amount).toMatch(/^-12,50/);
      expect(state.dateLabel).toMatch(/lunes, 12 de octubre/);
      expect(state.payerLabel).toBe('Leo');
    });

    it('an income has a plus sign and its own label', async () => {
      const { hook } = await setup(
        baseTx({
          type: 'income',
          categoryId: 'salary' as CategoryId,
          amount: Money.ofMinor(150_000, 'EUR'),
        }),
      );
      expect(ready(hook)).toMatchObject({
        type: 'income',
        typeLabel: 'Ingreso',
        categoryName: 'Nómina',
      });
      expect(ready(hook).amount).toMatch(/^\+1\.?500,00/);
    });

    it('does not know a payer that is not a member', async () => {
      const { hook } = await setup(baseTx({ payerId: 'stranger' as never }));
      expect(ready(hook).payerLabel).toBeNull();
    });

    it('a deleted or unknown movement is "not found"', async () => {
      const { hook } = await setup(null);
      expect(hook.result.current.state.status).toBe('not-found');
    });

    it('a missing id (a broken link) is also "not found"', async () => {
      const { hook } = await setup(baseTx(), undefined, { value: undefined });
      expect(hook.result.current.state.status).toBe('not-found');
    });

    it('other failures are an error with a friendly message', async () => {
      const kit = createTransactionsTestKit({ memory: { transactions: [baseTx()] } });
      jest.spyOn(kit.repository, 'getById').mockRejectedValue(new TransactionError('network'));
      const hook = await renderHook(() => useTransactionDetailViewModel('tx1'), {
        wrapper: kit.Wrapper,
      });
      await waitFor(() => expect(hook.result.current.state.status).toBe('error'));
      const state = hook.result.current.state;
      expect(state.status === 'error' && state.message).toContain('conexión');
    });
  });

  describe('editing', () => {
    it('opens the form with the current values', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.startEdit());
      const state = ready(hook);
      expect(state.mode).toBe('edit');
      expect(state.edit).toMatchObject({
        amountText: '12,50',
        description: 'Menú del día',
        canGoNextDay: true,
        canShare: false,
        canSave: true,
      });
      expect(state.edit?.categories.find((c) => c.selected)?.id).toBe('food');
      expect(state.edit?.categories.map((c) => c.id)).not.toContain('salary'); // expense only
    });

    it('writes whole euros without decimals', async () => {
      const { hook } = await setup(baseTx({ amount: Money.ofMinor(2_000, 'EUR') }));
      await act(async () => hook.result.current.startEdit());
      expect(ready(hook).edit?.amountText).toBe('20');
    });

    it('validates the amount while typing', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.startEdit());
      await act(async () => hook.result.current.changeAmount('abc'));
      expect(ready(hook).edit).toMatchObject({ canSave: false });
      expect(ready(hook).edit?.amountError).toContain('mayor que cero');
      await act(async () => hook.result.current.changeAmount('0'));
      expect(ready(hook).edit?.canSave).toBe(false);
      await act(async () => hook.result.current.changeAmount(''));
      expect(ready(hook).edit).toMatchObject({ canSave: false, amountError: null });
      await act(async () => hook.result.current.changeAmount('1.234,5'));
      expect(ready(hook).edit).toMatchObject({ canSave: true, amountError: null });
    });

    it('saves the changes, refreshes the detail and goes back to reading', async () => {
      const { hook, repository } = await setup();
      await act(async () => hook.result.current.startEdit());
      await act(async () => hook.result.current.changeAmount('30'));
      await act(async () => hook.result.current.selectCategory('leisure' as CategoryId));
      await act(async () => hook.result.current.changeDescription('Cena fuera'));
      await act(async () => hook.result.current.shiftDay(-1));

      let ok = false;
      await act(async () => {
        ok = await hook.result.current.saveEdit();
      });
      expect(ok).toBe(true);

      const saved = await repository.getById('tx1');
      expect(saved).toMatchObject({ categoryId: 'leisure', description: 'Cena fuera' });
      expect(saved?.amount.amountMinor).toBe(3_000);
      expect(saved?.occurredAt).toEqual(new Date(2026, 9, 11));

      await waitFor(() => expect(ready(hook).mode).toBe('view'));
      await waitFor(() => expect(ready(hook).description).toBe('Cena fuera'));
      expect(ready(hook).categoryName).toBe('Ocio');
    });

    it('invalidates the lists so Inicio and Historial refresh', async () => {
      const { hook, queryClient } = await setup();
      queryClient.setQueryData(queryKeys.transactions.list('h1', { x: 1 }), {
        items: [],
        nextCursor: null,
      });
      await act(async () => hook.result.current.startEdit());
      await act(async () => hook.result.current.changeAmount('9'));
      await act(async () => void (await hook.result.current.saveEdit()));
      expect(
        queryClient.getQueryState(queryKeys.transactions.list('h1', { x: 1 }))?.isInvalidated,
      ).toBe(true);
    });

    it('cannot move the day into the future', async () => {
      const { hook } = await setup(baseTx({ occurredAt: new Date(2026, 9, 14) }));
      await act(async () => hook.result.current.startEdit());
      expect(ready(hook).edit?.canGoNextDay).toBe(false);
      await act(async () => hook.result.current.shiftDay(1));
      expect(ready(hook).edit?.dayLabel).toMatch(/miércoles, 14 de octubre/);
      await act(async () => hook.result.current.shiftDay(-1));
      expect(ready(hook).edit?.dayLabel).toMatch(/martes, 13 de octubre/);
      expect(ready(hook).edit?.canGoNextDay).toBe(true);
    });

    it('cancelling throws the edits away', async () => {
      const { hook, repository } = await setup();
      await act(async () => hook.result.current.startEdit());
      await act(async () => hook.result.current.changeAmount('99'));
      await act(async () => hook.result.current.cancel());
      expect(ready(hook).mode).toBe('view');
      expect((await repository.getById('tx1'))?.amount.amountMinor).toBe(1_250);
      await act(async () => hook.result.current.startEdit());
      expect(ready(hook).edit?.amountText).toBe('12,50'); // reopened from the real values
    });

    it('shows why a save failed and stays in the form', async () => {
      const { hook, repository } = await setup();
      jest.spyOn(repository, 'update').mockRejectedValue(new TransactionError('forbidden'));
      await act(async () => hook.result.current.startEdit());
      await act(async () => hook.result.current.changeAmount('5'));
      let ok = true;
      await act(async () => {
        ok = await hook.result.current.saveEdit();
      });
      expect(ok).toBe(false);
      expect(ready(hook).mode).toBe('edit');
      expect(ready(hook).error).toContain('permiso');
    });

    it('limits the note to 80 characters', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.startEdit());
      await act(async () => hook.result.current.changeDescription('x'.repeat(200)));
      expect(ready(hook).edit?.description).toHaveLength(80);
    });

    it('offers "Compartido" only in a shared household with several members', async () => {
      const shared = await setup(baseTx(), householdOf('shared', true));
      await act(async () => shared.hook.result.current.startEdit());
      expect(ready(shared.hook).edit?.canShare).toBe(true);
      await act(async () => shared.hook.result.current.setShared(true));
      expect(ready(shared.hook).edit?.shared).toBe(true);
      await act(async () => void (await shared.hook.result.current.saveEdit()));
      expect((await shared.repository.getById('tx1'))?.shared).toBe(true);
      expect(ready(shared.hook).payerLabel).toBe('Leo');
      void ANA;
    });
  });

  describe('deleting', () => {
    it('asks first: nothing is deleted until it is confirmed', async () => {
      const { hook, repository } = await setup();
      await act(async () => hook.result.current.requestDelete());
      expect(ready(hook).mode).toBe('confirm-delete');
      expect(await repository.getById('tx1')).not.toBeNull();
    });

    it('"No, conservar" goes back without deleting', async () => {
      const { hook, repository } = await setup();
      await act(async () => hook.result.current.requestDelete());
      await act(async () => hook.result.current.cancel());
      expect(ready(hook).mode).toBe('view');
      expect(await repository.getById('tx1')).not.toBeNull();
    });

    it('confirming deletes, forgets the detail and refreshes the lists', async () => {
      const { hook, repository, queryClient } = await setup();
      queryClient.setQueryData(queryKeys.transactions.list('h1', { x: 1 }), {
        items: [],
        nextCursor: null,
      });
      await act(async () => hook.result.current.requestDelete());
      let ok = false;
      await act(async () => {
        ok = await hook.result.current.confirmDelete();
      });
      expect(ok).toBe(true);
      expect(await repository.getById('tx1')).toBeNull();
      expect(queryClient.getQueryData(queryKeys.transactions.detail('tx1'))).toBeUndefined();
      expect(
        queryClient.getQueryState(queryKeys.transactions.list('h1', { x: 1 }))?.isInvalidated,
      ).toBe(true);
    });

    it('if the delete fails it shows the reason and goes back to reading', async () => {
      const { hook, repository } = await setup();
      jest.spyOn(repository, 'delete').mockRejectedValue(new TransactionError('network'));
      await act(async () => hook.result.current.requestDelete());
      let ok = true;
      await act(async () => {
        ok = await hook.result.current.confirmDelete();
      });
      expect(ok).toBe(false);
      expect(ready(hook).mode).toBe('view');
      expect(ready(hook).error).toContain('conexión');
      expect(await repository.getById('tx1')).not.toBeNull();
    });
  });
});

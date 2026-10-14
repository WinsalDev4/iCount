import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';

import type { CategoryId, NewTransaction, Transaction } from '../../../domain/Transaction';
import { ME, createTransactionsTestKit, householdOf } from '../../../testing/transactionsTestKit';
import { useHomeViewModel } from '../useHomeViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

// Wednesday 14 October 2026: 18 days left in the month, week 12–18 October.
// Only Date is faked; timers stay real so TanStack Query keeps working.
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

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
let n = 0;
function tx(
  type: Transaction['type'],
  cents: number,
  date: Date,
  description: string,
): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    type,
    amount: eur(cents),
    categoryId: 'food' as CategoryId,
    description,
    occurredAt: date,
    householdId: 'h1',
    payerId: ME,
    shared: false,
    shares: [],
  };
}

const standard = () => [
  tx('income', 200_000, new Date(2026, 9, 1), 'Nómina'),
  tx('expense', 20_000, new Date(2026, 9, 12), 'Compra'),
  tx('expense', 5_000, new Date(2026, 9, 14), 'Café y tostadas'),
];

async function setup(
  transactions: Transaction[] = standard(),
  household = householdOf('personal'),
) {
  const kit = createTransactionsTestKit({
    household,
    memory: { transactions, now: () => new Date() },
  });
  const hook = await renderHook(() => useHomeViewModel(), { wrapper: kit.Wrapper });
  await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
  return { ...kit, hook };
}

function success(hook: Awaited<ReturnType<typeof setup>>['hook']) {
  const { state } = hook.result.current;
  if (state.status !== 'success') throw new Error(`expected success, got ${state.status}`);
  return state;
}

describe('useHomeViewModel', () => {
  it('is loading until the household and the three queries answer', async () => {
    const kit = createTransactionsTestKit({ memory: { transactions: standard() } });
    const { result } = await renderHook(() => useHomeViewModel(), { wrapper: kit.Wrapper });
    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('success'));
  });

  it("shows the money left today: the day's share minus today's spending", async () => {
    const { hook } = await setup();
    const state = success(hook);
    // Balance 1.750 €; the day started with 1.800 € → 100,00 € a day; 50 € spent → 50,00 € left.
    // es-ES does not group four-digit numbers ("1750,00 €"): the separator is optional.
    expect(state.monthBalance).toMatch(/1\.?750,00/);
    expect(state.leftToday).toMatch(/50,00/);
    expect(state.allowanceStatus).toBe('on-track');
    expect(state.caption).toContain('100,00');
    expect(state.caption).toContain('quedan 18 días');
  });

  it('draws the week: Monday to Sunday, the busiest day full, today highlighted', async () => {
    const { hook } = await setup();
    const { weekBars, weekTotal } = success(hook);
    expect(weekBars.map((b) => b.label)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(weekBars.map((b) => b.ratio)).toEqual([1, 0, 0.25, 0, 0, 0, 0]);
    expect(weekBars.map((b) => b.highlighted)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(weekBars[0]?.accessibilityLabel).toMatch(/lunes: 200,00/);
    expect(weekTotal).toMatch(/250,00/);
  });

  it('an empty week has flat bars, not NaN', async () => {
    const { hook } = await setup([tx('income', 1_000, new Date(2026, 9, 1), 'x')]);
    expect(success(hook).weekBars.every((b) => b.ratio === 0)).toBe(true);
  });

  it('lists the latest movements with their sign, a short date and a fallback note', async () => {
    const { hook } = await setup([...standard(), tx('expense', 100, new Date(2026, 9, 13), '')]);
    const { recent } = success(hook);
    expect(recent.map((r) => r.title)).toEqual(['Café y tostadas', 'Sin nota', 'Compra', 'Nómina']);
    expect(recent[0]).toMatchObject({ tone: 'expense', amount: expect.stringMatching(/^-50,00/) });
    expect(recent[3]).toMatchObject({
      tone: 'income',
      amount: expect.stringMatching(/^\+2\.?000,00/),
    });
    expect(recent[0]?.subtitle).toMatch(/14 oct/);
  });

  it('with no movements it still renders, as a deficit', async () => {
    const { hook } = await setup([]);
    const state = success(hook);
    expect(state.allowanceStatus).toBe('month-in-deficit');
    expect(state.recent).toEqual([]);
    expect(state.caption).toContain('gastado más');
  });

  it("going past the day's share is shown as a negative amount", async () => {
    const { hook } = await setup([
      tx('income', 10_000, new Date(2026, 9, 1), 'Nómina'),
      tx('expense', 9_000, new Date(2026, 9, 14), 'Cena'),
    ]);
    const state = success(hook);
    expect(state.allowanceStatus).toBe('over-today');
    expect(state.leftToday).toMatch(/^-/);
  });

  it('shows the household name and its members for the avatars', async () => {
    const { hook } = await setup(standard(), householdOf('shared', true));
    const state = success(hook);
    expect(state.householdName).toBe('Casa');
    expect(state.memberNames).toEqual(['Leo', 'Ana']);
  });

  it('keeps the budgets slot empty until phase 4', async () => {
    const { hook } = await setup();
    expect(success(hook).budgets).toBeNull();
  });

  it('refreshes by itself when a movement is added and the caches are invalidated', async () => {
    const kit = await setup();
    const before = success(kit.hook).leftToday;

    const added: NewTransaction = {
      id: 'new',
      householdId: 'h1',
      type: 'expense',
      amount: eur(1_000),
      categoryId: 'food' as CategoryId,
      description: 'Tarta',
      occurredAt: new Date(2026, 9, 14),
      shared: false,
    };
    await act(async () => {
      await kit.repository.create(added);
      await kit.queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all('h1') });
    });
    await waitFor(() => expect(success(kit.hook).recent.map((r) => r.title)).toContain('Tarta'));
    expect(success(kit.hook).leftToday).not.toBe(before);
  });

  it('turns a failing repository into a friendly error, and refresh retries', async () => {
    const kit = createTransactionsTestKit({ memory: { transactions: standard() } });
    jest.spyOn(kit.repository, 'findByMonth').mockRejectedValueOnce(new Error('boom: 10.0.2.2'));
    const hook = await renderHook(() => useHomeViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('error'));
    const state = hook.result.current.state;
    expect(state.status === 'error' && state.message).toBe(
      'No hemos podido cargar tu resumen. Inténtalo de nuevo.',
    );

    await act(async () => {
      await hook.result.current.refresh();
    });
    await waitFor(() => expect(hook.result.current.state.status).toBe('success'));
  });

  it('keeps showing the last data when a refresh fails (offline)', async () => {
    const kit = await setup();
    const shown = success(kit.hook).recent.map((r) => r.title);
    jest
      .spyOn(kit.repository, 'findByMonth')
      .mockRejectedValue(new Error('Network request failed'));

    await act(async () => {
      await kit.queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all('h1') });
    });

    expect(kit.hook.result.current.state.status).toBe('success');
    expect(success(kit.hook).recent.map((r) => r.title)).toEqual(shown);
  });
});

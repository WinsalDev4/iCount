import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Money } from '@/core/domain/Money';

import type { CategoryId, Transaction } from '../../../domain/Transaction';
import { ME, createTransactionsTestKit, householdOf } from '../../../testing/transactionsTestKit';
import { useHistoryViewModel } from '../useHistoryViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

// Wednesday 14 October 2026. Only Date is faked, so TanStack Query's timers keep working.
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
  extra: Partial<Transaction> = {},
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
    ...extra,
  };
}

const standard = () => [
  tx('income', 200_000, new Date(2026, 9, 1), 'Nómina', { categoryId: 'salary' as CategoryId }),
  tx('expense', 5_000, new Date(2026, 9, 14), 'Café y tostadas'),
  tx('expense', 20_000, new Date(2026, 9, 14), 'Cena', { shared: true }),
  tx('expense', 9_000, new Date(2026, 9, 12), 'Compra'),
  tx('expense', 3_000, new Date(2026, 8, 20), 'Cine'), // September
];

async function setup(
  transactions: Transaction[] = standard(),
  household = householdOf('personal'),
) {
  const kit = createTransactionsTestKit({ household, memory: { transactions } });
  const hook = await renderHook(() => useHistoryViewModel(), { wrapper: kit.Wrapper });
  await waitFor(() => {
    const { state } = hook.result.current;
    expect(state.status === 'ready' && state.listStatus === 'ready').toBe(true);
  });
  return { ...kit, hook };
}

type Hook = Awaited<ReturnType<typeof setup>>['hook'];
function ready(hook: Hook) {
  const { state } = hook.result.current;
  if (state.status !== 'ready') throw new Error('expected ready');
  return state;
}
const titles = (hook: Hook) => ready(hook).rows.map((r) => r.title);

describe('useHistoryViewModel', () => {
  it('starts on the current month with today selected and its movements listed', async () => {
    const { hook } = await setup();
    const state = ready(hook);
    expect(state.monthLabel).toBe('Octubre de 2026');
    expect(state.heading).toMatch(/miércoles, 14 de octubre/i);
    expect(state.filtering).toBe(false);
    expect(titles(hook).sort()).toEqual(['Café y tostadas', 'Cena']);
  });

  it('draws the month with padding, Monday first, today marked and selected', async () => {
    const { hook } = await setup();
    const { weeks, weekdays } = ready(hook);
    expect(weekdays).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.slice(0, 3)).toEqual([null, null, null]);
    const cells = weeks.flat().filter((c) => c !== null);
    expect(cells).toHaveLength(31);
    const today = cells.find((c) => c.day === 14);
    expect(today).toMatchObject({ isToday: true, selected: true });
    expect(cells.filter((c) => c.selected)).toHaveLength(1);
  });

  it('tints the days by spending and leaves empty days at level 0', async () => {
    const { hook } = await setup();
    const cells = ready(hook)
      .weeks.flat()
      .filter((c) => c !== null);
    const level = (day: number) => cells.find((c) => c.day === day)?.intensity;
    expect(level(14)).toBe(4); // 250 €: the heaviest of the three days with spending
    expect(level(12)).toBeGreaterThan(0);
    expect(level(14)).toBeGreaterThan(level(12) ?? 0);
    expect(level(5)).toBe(0);
    expect(cells.find((c) => c.day === 14)?.accessibilityLabel).toMatch(/250,00\s€\sgastados/);
    expect(cells.find((c) => c.day === 5)?.accessibilityLabel).toMatch(/sin gastos/);
  });

  it('shows the month totals', async () => {
    const { hook } = await setup();
    const state = ready(hook);
    expect(state.monthIncome).toMatch(/2\.?000,00/);
    expect(state.monthExpenses).toMatch(/340,00/);
  });

  it('selecting another day lists that day', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.selectDay(new Date(2026, 9, 12)));
    await waitFor(() => expect(titles(hook)).toEqual(['Compra']));
    expect(
      ready(hook)
        .weeks.flat()
        .find((c) => c?.day === 12)?.selected,
    ).toBe(true);
    expect(
      ready(hook)
        .weeks.flat()
        .find((c) => c?.day === 14)?.selected,
    ).toBe(false);
  });

  it('an empty day gives an empty list, not an error', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.selectDay(new Date(2026, 9, 5)));
    await waitFor(() => {
      expect(ready(hook).listStatus).toBe('ready');
      expect(ready(hook).rows).toEqual([]);
    });
  });

  describe('months', () => {
    it('goes back a month, selects its first day and loads its totals', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.previousMonth());
      await waitFor(() => expect(ready(hook).monthLabel).toBe('Septiembre de 2026'));
      await waitFor(() => expect(ready(hook).monthExpenses).toMatch(/30,00/));
      expect(
        ready(hook)
          .weeks.flat()
          .find((c) => c?.selected)?.day,
      ).toBe(1);
    });

    it('cannot go past the current month, and coming back selects today again', async () => {
      const { hook } = await setup();
      expect(ready(hook).canGoNext).toBe(false);
      await act(async () => hook.result.current.nextMonth());
      expect(ready(hook).monthLabel).toBe('Octubre de 2026');

      await act(async () => hook.result.current.previousMonth());
      await waitFor(() => expect(ready(hook).canGoNext).toBe(true));
      await act(async () => hook.result.current.nextMonth());
      await waitFor(() => expect(ready(hook).monthLabel).toBe('Octubre de 2026'));
      expect(
        ready(hook)
          .weeks.flat()
          .find((c) => c?.selected)?.day,
      ).toBe(14);
    });

    it('crosses the year boundary', async () => {
      const { hook } = await setup([]);
      for (let i = 0; i < 10; i++) {
        await act(async () => hook.result.current.previousMonth());
      }
      await waitFor(() => expect(ready(hook).monthLabel).toBe('Diciembre de 2025'));
    });
  });

  describe('search and filters', () => {
    it('searches across ALL dates, after a short pause, ignoring case and accents', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.setSearchText('cine'));
      expect(ready(hook).filtering).toBe(false); // not applied until the typing pauses
      await waitFor(() => expect(ready(hook).filtering).toBe(true));
      await waitFor(() => expect(titles(hook)).toEqual(['Cine']));
      expect(ready(hook).heading).toBe('Resultados');
      expect(ready(hook).rows[0]?.subtitle).toMatch(/20 sept/); // results show their date
      expect(
        ready(hook)
          .weeks.flat()
          .some((c) => c?.selected),
      ).toBe(false);
    });

    it('filters by type', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.setTypeFilter('income'));
      await waitFor(() => expect(titles(hook)).toEqual(['Nómina']));
      expect(ready(hook).rows[0]).toMatchObject({ tone: 'income' });
      expect(ready(hook).rows[0]?.amount).toMatch(/^\+2\.?000,00/);
    });

    it('filters shared movements and marks them in the subtitle', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.setSharedOnly(true));
      await waitFor(() => expect(titles(hook)).toEqual(['Cena']));
      expect(ready(hook).rows[0]?.subtitle).toContain('compartido');
    });

    it('combines text and type', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.setTypeFilter('expense'));
      await act(async () => hook.result.current.setSearchText('a'));
      await waitFor(() => expect(titles(hook).length).toBeGreaterThan(0));
      expect(ready(hook).rows.every((r) => r.tone === 'expense')).toBe(true);
    });

    it('clearing the filters goes back to the selected day', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.setTypeFilter('income'));
      await waitFor(() => expect(ready(hook).filtering).toBe(true));
      await act(async () => hook.result.current.clearFilters());
      await waitFor(() => expect(ready(hook).filtering).toBe(false));
      await waitFor(() => expect(titles(hook).sort()).toEqual(['Café y tostadas', 'Cena']));
    });

    it('tapping a day leaves the search', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.setTypeFilter('income'));
      await waitFor(() => expect(ready(hook).filtering).toBe(true));
      await act(async () => hook.result.current.selectDay(new Date(2026, 9, 12)));
      await waitFor(() => expect(ready(hook).filtering).toBe(false));
      expect(ready(hook).typeFilter).toBe('all');
    });

    it('no matches is an empty list', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.setSearchText('zzzz'));
      await waitFor(() => expect(ready(hook).filtering).toBe(true));
      await waitFor(() => expect(ready(hook).rows).toEqual([]));
    });
  });

  it('loads more pages as you scroll', async () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      tx('expense', 100 + i, new Date(2026, 9, 14), `Mov ${i}`),
    );
    const { hook } = await setup(many);
    expect(ready(hook).rows).toHaveLength(20);
    expect(ready(hook).hasMore).toBe(true);

    await act(async () => hook.result.current.loadMore());
    await waitFor(() => expect(ready(hook).rows).toHaveLength(40));
    await act(async () => hook.result.current.loadMore());
    await waitFor(() => expect(ready(hook).rows).toHaveLength(45));
    expect(ready(hook).hasMore).toBe(false);

    await act(async () => hook.result.current.loadMore()); // nothing left: harmless
    expect(ready(hook).rows).toHaveLength(45);
  });

  it('shows an error state for the list when it fails, and refresh recovers', async () => {
    const kit = createTransactionsTestKit({ memory: { transactions: standard() } });
    jest.spyOn(kit.repository, 'list').mockRejectedValueOnce(new Error('boom'));
    const hook = await renderHook(() => useHistoryViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => {
      const { state } = hook.result.current;
      expect(state.status === 'ready' && state.listStatus).toBe('error');
    });
    await act(async () => {
      await hook.result.current.refresh();
    });
    await waitFor(() => expect(ready(hook).listStatus).toBe('ready'));
  });

  it('uses the category name as the title of a movement without a note', async () => {
    const { hook } = await setup([tx('expense', 100, new Date(2026, 9, 14), '')]);
    expect(ready(hook).rows[0]?.title).toBe('Comida');
  });
});

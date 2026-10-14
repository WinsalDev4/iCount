import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';
import {
  createTransactionsTestKit,
  householdOf,
} from '@/features/transactions/testing/transactionsTestKit';
import type { Transaction } from '@/features/transactions/domain/Transaction';

import { useBudgetFormViewModel } from '../useBudgetFormViewModel';
import { useBudgetsViewModel } from '../useBudgetsViewModel';
import { useMoveBudgetViewModel } from '../useMoveBudgetViewModel';

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

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const OCT = { year: 2026, month: 10 };
const food = 'food' as CategoryId;
const leisure = 'leisure' as CategoryId;
const transport = 'transport' as CategoryId;

function spend(categoryId: CategoryId, cents: number): Transaction {
  return {
    id: `t-${categoryId}-${cents}`,
    type: 'expense',
    amount: eur(cents),
    categoryId,
    description: '',
    occurredAt: new Date(2026, 9, 10),
    householdId: 'h1',
    payerId: 'u' as never,
    shared: false,
    shares: [],
  };
}

async function kitWithBudgets(transactions: Transaction[] = []) {
  const kit = createTransactionsTestKit({ memory: { transactions } });
  const a = await kit.budgetRepository.create({
    householdId: 'h1',
    categoryId: food,
    month: OCT,
    limit: eur(30_000),
  });
  const b = await kit.budgetRepository.create({
    householdId: 'h1',
    categoryId: leisure,
    month: OCT,
    limit: eur(10_000),
  });
  return { ...kit, a, b };
}

describe('useBudgetsViewModel', () => {
  async function setup(transactions: Transaction[] = []) {
    const kit = await kitWithBudgets(transactions);
    const hook = await renderHook(() => useBudgetsViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error('expected ready');
    return state;
  };

  it('lists the budgets with their amounts, most worrying first', async () => {
    const { hook } = await setup([spend(food, 6_000), spend(leisure, 12_000)]);
    const state = ready(hook);
    expect(state.monthLabel).toBe('Octubre de 2026');
    expect(state.isCurrentMonth).toBe(true);
    expect(state.rows.map((r) => [r.categoryName, r.status])).toEqual([
      ['Ocio', 'exceeded'],
      ['Comida', 'ok'],
    ]);
    expect(state.rows[0]?.statusLabel).toMatch(/^Te has pasado 20,00/);
    expect(state.rows[1]?.statusLabel).toMatch(/^Quedan 240,00/);
  });

  it('adds up the month in a total', async () => {
    const { hook } = await setup([spend(food, 6_000), spend(leisure, 12_000)]);
    const total = ready(hook).total;
    expect(total?.limit).toMatch(/400,00/);
    expect(total?.spent).toMatch(/180,00/);
    expect(total?.statusLabel).toMatch(/^Quedan 220,00/);
  });

  it('has no total and no rows for an empty month', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.previousMonth());
    await waitFor(() => expect(ready(hook).monthLabel).toBe('Septiembre de 2026'));
    await waitFor(() => expect(ready(hook).rows).toEqual([]));
    expect(ready(hook).total).toBeNull();
    expect(ready(hook).isCurrentMonth).toBe(false);
  });

  it('cannot go into the future', async () => {
    const { hook } = await setup();
    expect(ready(hook).canGoNext).toBe(false);
    await act(async () => hook.result.current.nextMonth());
    expect(ready(hook).monthLabel).toBe('Octubre de 2026');
  });

  it('shows a friendly error when loading fails', async () => {
    const kit = createTransactionsTestKit();
    jest.spyOn(kit.budgetRepository, 'list').mockRejectedValue(new Error('boom'));
    const hook = await renderHook(() => useBudgetsViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('error'));
  });
});

describe('useBudgetFormViewModel', () => {
  async function setup(id?: string, transactions: Transaction[] = []) {
    const kit = await kitWithBudgets(transactions);
    const hook = await renderHook(() => useBudgetFormViewModel(id === 'a' ? kit.a.id : id), {
      wrapper: kit.Wrapper,
    });
    await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
    return state;
  };

  describe('creating', () => {
    it('offers only expense categories that have no budget yet', async () => {
      const { hook } = await setup();
      const ids = ready(hook).categories.map((c) => c.id);
      expect(ids).not.toContain('food');
      expect(ids).not.toContain('leisure');
      expect(ids).not.toContain('salary');
      expect(ids).toContain('transport');
      expect(ready(hook).mode).toBe('create');
    });

    it('needs a valid limit to save, with a hint while the text is invalid', async () => {
      const { hook } = await setup();
      expect(ready(hook).canSave).toBe(false);
      await act(async () => hook.result.current.changeLimit('abc'));
      expect(ready(hook)).toMatchObject({ canSave: false });
      expect(ready(hook).limitError).toContain('mayor que cero');
      await act(async () => hook.result.current.changeLimit('0'));
      expect(ready(hook).canSave).toBe(false);
      await act(async () => hook.result.current.changeLimit('250'));
      expect(ready(hook)).toMatchObject({ canSave: true, limitError: null });
    });

    it('creates the budget for the current month in the chosen category', async () => {
      const { hook, budgetRepository } = await setup();
      await act(async () => hook.result.current.selectCategory('transport'));
      await act(async () => hook.result.current.changeLimit('80,50'));
      let ok = false;
      await act(async () => {
        ok = await hook.result.current.save();
      });
      expect(ok).toBe(true);
      const created = (await budgetRepository.list('h1', OCT)).find(
        (b) => b.categoryId === transport,
      );
      expect(created?.limit.amountMinor).toBe(8_050);
    });

    it('defaults to the first free category', async () => {
      const { hook, budgetRepository } = await setup();
      const first = ready(hook).categories[0]?.id as string;
      await act(async () => hook.result.current.changeLimit('10'));
      await act(async () => void (await hook.result.current.save()));
      expect((await budgetRepository.list('h1', OCT)).some((b) => b.categoryId === first)).toBe(
        true,
      );
    });

    it('shows the reason when saving fails', async () => {
      const { hook, budgetRepository } = await setup();
      jest
        .spyOn(budgetRepository, 'create')
        .mockRejectedValue(
          Object.assign(new Error('dup'), { name: 'BudgetError', reason: 'duplicate' }),
        );
      await act(async () => hook.result.current.changeLimit('10'));
      let ok = true;
      await act(async () => {
        ok = await hook.result.current.save();
      });
      expect(ok).toBe(false);
      expect(ready(hook).error).toBe('Algo ha salido mal. Inténtalo de nuevo.');
    });
  });

  describe('editing', () => {
    it('starts from the stored limit and the category name', async () => {
      const { hook } = await setup('a');
      const state = ready(hook);
      expect(state).toMatchObject({ mode: 'edit', categoryName: 'Comida', limitText: '300' });
      expect(state.canSave).toBe(true);
    });

    it('saves a new limit', async () => {
      const { hook, budgetRepository } = await setup('a');
      await act(async () => hook.result.current.changeLimit('450,75'));
      await act(async () => void (await hook.result.current.save()));
      const food1 = (await budgetRepository.list('h1', OCT)).find((b) => b.categoryId === food);
      expect(food1?.limit.amountMinor).toBe(45_075);
    });

    it('asks before deleting and deletes only on confirmation', async () => {
      const { hook, budgetRepository } = await setup('a');
      await act(async () => hook.result.current.requestDelete());
      expect(ready(hook).confirmingDelete).toBe(true);
      expect(await budgetRepository.list('h1', OCT)).toHaveLength(2);

      await act(async () => hook.result.current.cancelDelete());
      expect(ready(hook).confirmingDelete).toBe(false);
      expect(await budgetRepository.list('h1', OCT)).toHaveLength(2);

      await act(async () => hook.result.current.requestDelete());
      let ok = false;
      await act(async () => {
        ok = await hook.result.current.confirmDelete();
      });
      expect(ok).toBe(true);
      expect(await budgetRepository.list('h1', OCT)).toHaveLength(1);
    });

    it('a deleted or unknown budget is "not found"', async () => {
      const { hook } = await setup('missing');
      expect(hook.result.current.state.status).toBe('not-found');
    });
  });
});

describe('useMoveBudgetViewModel', () => {
  async function setup(transactions: Transaction[] = []) {
    const kit = await kitWithBudgets(transactions);
    const hook = await renderHook(() => useMoveBudgetViewModel(kit.a.id), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
    return state;
  };

  it('offers the other budgets as targets and how much can leave', async () => {
    const { hook } = await setup([spend(food, 25_000)]);
    const state = ready(hook);
    expect(state.fromName).toBe('Comida');
    expect(state.targets.map((t) => [t.name, t.selected])).toEqual([['Ocio', true]]);
    expect(state.movable).toMatch(/50,00/); // limit 300, spent 250
  });

  it('validates the amount against what can leave and previews the result', async () => {
    const { hook } = await setup([spend(food, 25_000)]);
    await act(async () => hook.result.current.changeAmount('60'));
    expect(ready(hook)).toMatchObject({ canMove: false });
    expect(ready(hook).amountError).toMatch(/Como mucho puedes mover 50,00/);
    expect(ready(hook).preview).toEqual([]);

    await act(async () => hook.result.current.changeAmount('20'));
    expect(ready(hook)).toMatchObject({ canMove: true, amountError: null });
    expect(ready(hook).preview[0]).toMatch(/Comida: 300,00.* → 280,00/);
    expect(ready(hook).preview[1]).toMatch(/Ocio: 100,00.* → 120,00/);
  });

  it('moves the amount and keeps the total limit', async () => {
    const { hook, budgetRepository } = await setup();
    await act(async () => hook.result.current.changeAmount('50'));
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.submit();
    });
    expect(ok).toBe(true);
    const limits = (await budgetRepository.list('h1', OCT)).map((b) => b.limit.amountMinor).sort();
    expect(limits).toEqual([15_000, 25_000]);
  });

  it('shows why a move failed', async () => {
    const { hook, budgetRepository } = await setup();
    jest.spyOn(budgetRepository, 'moveAmount').mockRejectedValue(new Error('x'));
    await act(async () => hook.result.current.changeAmount('5'));
    let ok = true;
    await act(async () => {
      ok = await hook.result.current.submit();
    });
    expect(ok).toBe(false);
    expect(ready(hook).error).toContain('Algo ha salido mal');
  });

  it('says there is nothing to move when there is no other budget', async () => {
    const kit = createTransactionsTestKit();
    const only = await kit.budgetRepository.create({
      householdId: 'h1',
      categoryId: food,
      month: OCT,
      limit: eur(100),
    });
    const hook = await renderHook(() => useMoveBudgetViewModel(only.id), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('nothing-to-move'));
  });

  it('says there is nothing to move when everything is spent', async () => {
    const { hook } = await setup([spend(food, 30_000)]);
    expect(hook.result.current.state.status).toBe('nothing-to-move');
  });

  it('unknown source is "not found"', async () => {
    const kit = await kitWithBudgets();
    const hook = await renderHook(() => useMoveBudgetViewModel('nope'), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('not-found'));
  });

  void householdOf;
});

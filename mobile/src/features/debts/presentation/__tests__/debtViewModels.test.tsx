import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Money } from '@/core/domain/Money';

import type { NewDebt } from '../../domain/Debt';
import { createDebtsTestKit } from '../../testing/debtsTestKit';
import { formatMonths } from '../debtLabels';
import { useDebtDetailViewModel } from '../useDebtDetailViewModel';
import { useDebtFormViewModel } from '../useDebtFormViewModel';
import { useDebtsViewModel } from '../useDebtsViewModel';
import { useStrategyViewModel } from '../useStrategyViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

// 14 October 2026. Only Date is faked, so TanStack Query's timers keep working.
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
const loan = (extra: Partial<NewDebt> = {}): NewDebt => ({
  householdId: 'h1',
  name: 'Coche',
  kind: 'car',
  principal: eur(1_200_000),
  annualRateBps: 690,
  startDate: new Date(2025, 9, 15),
  termMonths: 60,
  ...extra,
});

async function kitWith(...loans: NewDebt[]) {
  const kit = createDebtsTestKit({ now: () => new Date() });
  const debts = [];
  for (const l of loans) debts.push(await kit.repository.create(l));
  return { ...kit, debts };
}

describe('formatMonths', () => {
  it.each([
    [0, '0 meses'],
    [1, '1 mes'],
    [5, '5 meses'],
    [12, '1 año'],
    [14, '1 año y 2 meses'],
    [24, '2 años'],
    [25, '2 años y 1 mes'],
  ])('%i → %s', (months, text) => {
    expect(formatMonths(months)).toBe(text);
  });
});

describe('useDebtsViewModel', () => {
  async function setup(...loans: NewDebt[]) {
    const kit = await kitWith(...loans);
    const hook = await renderHook(() => useDebtsViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error('expected ready');
    return state;
  };

  it('totals what is owed and the monthly instalments', async () => {
    const { hook, debts } = await setup(
      loan(),
      loan({
        name: 'Tarjeta',
        kind: 'credit-card',
        principal: eur(200_000),
        termMonths: 24,
        annualRateBps: 2_100,
      }),
    );
    const state = ready(hook);
    expect(state.aliveCount).toBe(2);
    const owed = debts.reduce((sum, d) => sum + d.outstanding.amountMinor, 0);
    expect(state.totalOutstanding).toBe(eur(owed).format());
  });

  it('describes each debt: kind, rate, progress and next instalment', async () => {
    const { hook } = await setup(loan());
    const [row] = ready(hook).rows;
    expect(row).toMatchObject({
      name: 'Coche',
      kindLabel: 'Coche',
      rate: '6,90 %',
      paidOff: false,
    });
    expect(row?.paidPercent).toBeGreaterThan(10);
    expect(row?.paidPercent).toBeLessThan(40);
    expect(row?.nextPayment).toMatch(/^Próxima cuota: 15 de octubre de 2026/);
  });

  it('marks a paid-off debt and leaves it out of the totals', async () => {
    const { hook } = await setup(loan({ startDate: new Date(2018, 0, 1), termMonths: 12 }));
    const state = ready(hook);
    expect(state.aliveCount).toBe(0);
    expect(state.rows[0]).toMatchObject({ paidOff: true, nextPayment: 'Pagada', paidPercent: 100 });
  });

  it('is an empty list without debts', async () => {
    const { hook } = await setup();
    expect(ready(hook).rows).toEqual([]);
    expect(ready(hook).aliveCount).toBe(0);
  });

  it('shows a friendly error when loading fails', async () => {
    const kit = createDebtsTestKit();
    jest.spyOn(kit.repository, 'list').mockRejectedValue(new Error('boom'));
    const hook = await renderHook(() => useDebtsViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('error'));
  });
});

describe('useDebtDetailViewModel', () => {
  async function setup(id?: string, ...loans: NewDebt[]) {
    const kit = await kitWith(...(loans.length ? loans : [loan()]));
    const debtId = id === 'first' ? kit.debts[0]?.id : id;
    const hook = await renderHook(() => useDebtDetailViewModel(debtId), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
    return state;
  };

  it('shows the debt: balance, instalment, end date, progress and what is left', async () => {
    const { hook } = await setup('first');
    const state = ready(hook);
    expect(state).toMatchObject({
      name: 'Coche',
      kindLabel: 'Coche',
      rate: '6,90 %',
      paidOff: false,
    });
    expect(state.endDate).toMatch(/septiembre de 2030/);
    expect(state.nextPayment).toMatch(/15 de octubre de 2026/);
    expect(state.remaining).toMatch(/^48 cuotas \(4 años\)/);
    expect(state.paidPercent).toBeGreaterThan(10);
  });

  it('starts with the +50 € extra selected and simulates it on the device', async () => {
    const { hook } = await setup('first');
    const state = ready(hook);
    expect(state.extraChips.map((c) => [c.label.replace(/\s/g, ' '), c.selected])).toEqual([
      ['Sin extra', false],
      ['+50 €', true],
      ['+100 €', false],
      ['+200 €', false],
    ]);
    expect(state.simulation?.monthsSaved).toBeGreaterThan(0);
    expect(state.simulation?.headline).toMatch(/^Terminas .* antes$/);
    expect(state.simulation?.interestSaved).toMatch(/€/);
  });

  it('a bigger extra saves more months', async () => {
    const { hook } = await setup('first');
    const months50 = ready(hook).simulation?.monthsSaved ?? 0;
    await act(async () => hook.result.current.selectExtra(20_000));
    expect(ready(hook).simulation?.monthsSaved).toBeGreaterThan(months50);
  });

  it('"Sin extra" shows no simulation', async () => {
    const { hook } = await setup('first');
    await act(async () => hook.result.current.selectExtra(0));
    expect(ready(hook).simulation).toBeNull();
  });

  it('a paid-off debt has no simulator', async () => {
    const { hook } = await setup(
      'first',
      loan({ startDate: new Date(2018, 0, 1), termMonths: 12 }),
    );
    const state = ready(hook);
    expect(state).toMatchObject({
      paidOff: true,
      remaining: 'Pagada',
      nextPayment: null,
      simulation: null,
    });
  });

  it('an unknown or missing id is "not found"', async () => {
    expect((await setup('nope')).hook.result.current.state.status).toBe('not-found');
    const kit = createDebtsTestKit();
    const hook = await renderHook(() => useDebtDetailViewModel(undefined), {
      wrapper: kit.Wrapper,
    });
    expect(hook.result.current.state.status).toBe('not-found');
  });

  it('asks before deleting, and deletes only when confirmed', async () => {
    const { hook, repository } = await setup('first');
    await act(async () => hook.result.current.requestDelete());
    expect(ready(hook).confirmingDelete).toBe(true);
    expect(await repository.list('h1')).toHaveLength(1);

    await act(async () => hook.result.current.cancelDelete());
    expect(ready(hook).confirmingDelete).toBe(false);

    await act(async () => hook.result.current.requestDelete());
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.confirmDelete();
    });
    expect(ok).toBe(true);
    expect(await repository.list('h1')).toEqual([]);
  });

  it('shows why a delete failed and goes back to reading', async () => {
    const { hook, repository } = await setup('first');
    jest.spyOn(repository, 'delete').mockRejectedValue(new Error('x'));
    await act(async () => hook.result.current.requestDelete());
    await act(async () => void (await hook.result.current.confirmDelete()));
    expect(ready(hook)).toMatchObject({ confirmingDelete: false });
    expect(ready(hook).error).toContain('Algo ha salido mal');
  });
});

describe('useDebtFormViewModel', () => {
  async function setup(id?: string) {
    const kit = await kitWith(loan());
    const debtId = id === 'first' ? kit.debts[0]?.id : id;
    const hook = await renderHook(() => useDebtFormViewModel(debtId), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
    return state;
  };

  async function fillCreate(hook: Awaited<ReturnType<typeof setup>>['hook']) {
    await act(async () => hook.result.current.changeName('  Préstamo   personal '));
    await act(async () => hook.result.current.changePrincipal('4.500'));
    await act(async () => hook.result.current.changeRate('5,9'));
    await act(async () => hook.result.current.changeTerm('36'));
  }

  describe('creating', () => {
    it('needs a name, principal, rate and term', async () => {
      const { hook } = await setup();
      expect(ready(hook)).toMatchObject({ mode: 'create', canSave: false });
      await fillCreate(hook);
      expect(ready(hook).canSave).toBe(true);
    });

    it('explains each invalid field', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.changePrincipal('abc'));
      await act(async () => hook.result.current.changeRate('150'));
      await act(async () => hook.result.current.changeTerm('0'));
      await act(async () => hook.result.current.changePayment('x'));
      const state = ready(hook);
      expect(state.principalError).toContain('mayor que cero');
      expect(state.rateError).toContain('porcentaje');
      expect(state.termError).toContain('meses');
      expect(state.paymentError).toContain('cuota');
      expect(state.canSave).toBe(false);
    });

    it('creates the debt, computing the instalment when it is left empty', async () => {
      const { hook, repository } = await setup();
      await fillCreate(hook);
      let ok = false;
      await act(async () => {
        ok = await hook.result.current.save();
      });
      expect(ok).toBe(true);
      const created = (await repository.list('h1')).find((d) => d.name === 'Préstamo personal');
      expect(created).toMatchObject({ kind: 'other', annualRateBps: 590, termMonths: 36 });
      expect(created?.principal.amountMinor).toBe(450_000);
      expect(created?.monthlyPayment.amountMinor).toBeGreaterThan(13_000);
    });

    it('uses an explicit instalment and the chosen kind', async () => {
      const { hook, repository } = await setup();
      await fillCreate(hook);
      await act(async () => hook.result.current.selectKind('credit-card'));
      await act(async () => hook.result.current.changePayment('200'));
      await act(async () => void (await hook.result.current.save()));
      const created = (await repository.list('h1')).find((d) => d.name === 'Préstamo personal');
      expect(created).toMatchObject({ kind: 'credit-card' });
      expect(created?.monthlyPayment.amountMinor).toBe(20_000);
    });

    it('moves the first-instalment date by months and years', async () => {
      const { hook } = await setup();
      expect(ready(hook).startLabel).toMatch(/14 de octubre de 2026/);
      await act(async () => hook.result.current.shiftStart(-12));
      expect(ready(hook).startLabel).toMatch(/14 de octubre de 2025/);
      await act(async () => hook.result.current.shiftStart(-1));
      expect(ready(hook).startLabel).toMatch(/14 de septiembre de 2025/);
      await act(async () => hook.result.current.shiftStart(1));
      expect(ready(hook).startLabel).toMatch(/14 de octubre de 2025/);
    });

    it('keeps the day when it fits and clamps it in a short month', async () => {
      const { hook } = await setup();
      // 14th stays the 14th; to test clamping start from the 31st of a long month.
      jest.setSystemTime(new Date(2026, 0, 31, 10));
      const kit = createDebtsTestKit();
      const other = await renderHook(() => useDebtFormViewModel(undefined), {
        wrapper: kit.Wrapper,
      });
      await waitFor(() => expect(other.result.current.state.status).toBe('ready'));
      await act(async () => other.result.current.shiftStart(1));
      const state = other.result.current.state;
      expect(state.status === 'ready' && state.startLabel).toMatch(/28 de febrero de 2026/);
      void hook;
    });

    it('shows why saving failed (an instalment below the interest)', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.changeName('Hipoteca'));
      await act(async () => hook.result.current.changePrincipal('200000'));
      await act(async () => hook.result.current.changeRate('6'));
      await act(async () => hook.result.current.changeTerm('300'));
      await act(async () => hook.result.current.changePayment('10'));
      let ok = true;
      await act(async () => {
        ok = await hook.result.current.save();
      });
      expect(ok).toBe(false);
      expect(ready(hook).error).toContain('cuota tiene que cubrir');
    });
  });

  describe('editing', () => {
    it('starts from the stored debt and shows the borrowed amount as history', async () => {
      const { hook } = await setup('first');
      const state = ready(hook);
      expect(state).toMatchObject({
        mode: 'edit',
        name: 'Coche',
        rateText: '6,90',
        termText: '60',
      });
      expect(state.principalText).toBe('12000');
      expect(state.startLabel).toMatch(/15 de octubre de 2025/);
      expect(state.canSave).toBe(true);
    });

    it('saves the changes and recomputes the instalment when the term changes', async () => {
      const { hook, repository, debts } = await setup('first');
      await act(async () => hook.result.current.changeName('Coche familiar'));
      await act(async () => hook.result.current.changeTerm('84'));
      await act(async () => hook.result.current.changePayment(''));
      await act(async () => void (await hook.result.current.save()));
      const updated = await repository.getById(debts[0]?.id ?? '');
      expect(updated).toMatchObject({ name: 'Coche familiar', termMonths: 84 });
      expect(updated?.monthlyPayment.amountMinor).toBeLessThan(
        debts[0]?.monthlyPayment.amountMinor ?? 0,
      );
    });

    it('an unknown debt is "not found"', async () => {
      const { hook } = await setup('nope');
      expect(hook.result.current.state.status).toBe('not-found');
    });
  });
});

describe('useStrategyViewModel', () => {
  async function setup(...loans: NewDebt[]) {
    const kit = await kitWith(...loans);
    const hook = await renderHook(() => useStrategyViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
    return { ...kit, hook };
  }
  const two = () => [
    loan(),
    loan({
      name: 'Tarjeta',
      kind: 'credit-card',
      principal: eur(300_000),
      termMonths: 24,
      annualRateBps: 2_100,
      startDate: new Date(2026, 5, 1),
    }),
  ];

  it('compares the two strategies, with the order each follows', async () => {
    const { hook } = await setup(...two());
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error('expected ready');
    const [avalanche, snowball] = state.cards;
    expect(avalanche).toMatchObject({ key: 'avalanche', title: 'Avalancha' });
    expect(snowball).toMatchObject({ key: 'snowball', title: 'Bola de nieve' });
    expect(avalanche.order[0]).toBe('1. Tarjeta'); // highest rate first
    expect(snowball.order[0]).toBe('1. Tarjeta'); // smallest balance first (card 3.000 € vs car ~9.000 €)
    expect(state.recommendation.length).toBeGreaterThan(10);
  });

  it('recommends the avalanche when it saves interest, and names the quick win', async () => {
    const { hook } = await setup(
      loan({ annualRateBps: 2_100, principal: eur(1_000_000) }), // big and expensive
      loan({
        name: 'Pequeña',
        principal: eur(100_000),
        annualRateBps: 300,
        termMonths: 24,
        startDate: new Date(2026, 8, 1),
      }),
    );
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.recommendation).toMatch(/^La avalancha te ahorra .* en intereses/);
    expect(state.firstWin).toBe('Pequeña');
  });

  it('with a single debt both strategies cost the same', async () => {
    const { hook } = await setup(loan());
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.recommendation).toContain('cuestan lo mismo');
  });

  it('changing the extra recalculates', async () => {
    const { hook } = await setup(...two());
    const before = hook.result.current.state;
    await act(async () => hook.result.current.selectExtra(20_000));
    const after = hook.result.current.state;
    if (before.status !== 'ready' || after.status !== 'ready') throw new Error('expected ready');
    expect(after.cards[0].debtFreeDate).not.toBe(before.cards[0].debtFreeDate);
    expect(after.extraChips.find((c) => c.selected)?.minor).toBe(20_000);
  });

  it('says there is nothing to compare when nothing is owed', async () => {
    const { hook } = await setup();
    expect(hook.result.current.state.status).toBe('nothing-owed');
  });
});

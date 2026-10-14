import { Money } from '@/core/domain/Money';

import { budgetProgress, sortByUrgency, summarizeBudgets } from '../budgetProgress';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const budget = (limit: number, spent: number) => ({ limit: eur(limit), spent: eur(spent) });

describe('budgetProgress', () => {
  it('nothing spent is an empty, calm bar', () => {
    expect(budgetProgress(budget(10_000, 0))).toEqual({ ratio: 0, percent: 0, status: 'ok' });
  });

  it('half way is "ok"', () => {
    expect(budgetProgress(budget(10_000, 5_000))).toEqual({
      ratio: 0.5,
      percent: 50,
      status: 'ok',
    });
  });

  it('turns to "warning" at 80 % exactly, not before', () => {
    expect(budgetProgress(budget(10_000, 7_999)).status).toBe('ok');
    expect(budgetProgress(budget(10_000, 8_000)).status).toBe('warning');
    expect(budgetProgress(budget(10_000, 9_999)).status).toBe('warning');
  });

  it('spending exactly the limit is full but NOT exceeded', () => {
    expect(budgetProgress(budget(10_000, 10_000))).toEqual({
      ratio: 1,
      percent: 100,
      status: 'warning',
    });
  });

  it('one cent over is exceeded, drawn full, with the real percentage', () => {
    const progress = budgetProgress(budget(10_000, 10_001));
    expect(progress.status).toBe('exceeded');
    expect(progress.ratio).toBe(1);
    expect(progress.percent).toBe(100);
  });

  it('far over shows the real percentage but the bar stays at 1', () => {
    expect(budgetProgress(budget(10_000, 25_000))).toEqual({
      ratio: 1,
      percent: 250,
      status: 'exceeded',
    });
  });

  it('rounds the percentage down, so 99,9 % is never shown as 100 %', () => {
    expect(budgetProgress(budget(100_000, 99_999)).percent).toBe(99);
  });

  it('a limit of zero is exceeded as soon as anything is spent', () => {
    expect(budgetProgress(budget(0, 0))).toEqual({ ratio: 0, percent: 0, status: 'ok' });
    expect(budgetProgress(budget(0, 1)).status).toBe('exceeded');
  });
});

describe('summarizeBudgets', () => {
  it('adds limits and spending and derives the remainder', () => {
    const totals = summarizeBudgets([budget(30_000, 12_000), budget(10_000, 11_000)], 'EUR');
    expect(totals.limit.amountMinor).toBe(40_000);
    expect(totals.spent.amountMinor).toBe(23_000);
    expect(totals.remaining.amountMinor).toBe(17_000);
    expect(totals.progress.status).toBe('ok');
  });

  it('can be over as a whole', () => {
    const totals = summarizeBudgets([budget(10_000, 15_000)], 'EUR');
    expect(totals.remaining.amountMinor).toBe(-5_000);
    expect(totals.progress.status).toBe('exceeded');
  });

  it('is all zeros without budgets', () => {
    const totals = summarizeBudgets([], 'EUR');
    expect(totals.limit.amountMinor).toBe(0);
    expect(totals.progress.status).toBe('ok');
  });
});

describe('sortByUrgency', () => {
  it('puts exceeded first, then the fullest', () => {
    const items = [
      { id: 'calm', ...budget(10_000, 1_000) },
      { id: 'over', ...budget(10_000, 12_000) },
      { id: 'almost', ...budget(10_000, 9_000) },
      { id: 'half', ...budget(10_000, 5_000) },
    ];
    expect(sortByUrgency(items).map((i) => i.id)).toEqual(['over', 'almost', 'half', 'calm']);
  });

  it('puts an exceeded budget before a full one even if the ratio ties at 1', () => {
    const items = [
      { id: 'full', ...budget(10_000, 10_000) },
      { id: 'over', ...budget(10_000, 10_001) },
    ];
    expect(sortByUrgency(items).map((i) => i.id)).toEqual(['over', 'full']);
  });

  it('does not mutate its input', () => {
    const items = [{ ...budget(1, 0) }, { ...budget(1, 1) }];
    const copy = [...items];
    sortByUrgency(items);
    expect(items).toEqual(copy);
  });
});

import { couple, tidyFlat, yearlyDuplicate } from '../eval/fixtures.js';
import { detectAll, monthlyCost, suggestedExtraPayment } from './findings.js';

const normalise = (text: string) => text.replace(/\s/g, ' ');

describe('advisor detectors', () => {
  const findings = detectAll(couple);
  const byKind = (kind: string) => findings.filter((finding) => finding.kind === kind);

  it('finds one of each kind in the couple household, most money first', () => {
    expect(findings.map((finding) => finding.kind).sort()).toEqual([
      'budget-exceeded',
      'duplicate-subscription',
      'expensive-debt',
      'unusual-spending',
    ]);
    const weights = findings.map((finding) => finding.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it('duplicate subscriptions: keeps the most expensive and cancels the rest', () => {
    const [duplicate] = byKind('duplicate-subscription');
    expect(duplicate?.potentialMonthlySavingsMinor).toBe(699);
    expect(duplicate?.actions).toEqual([
      { type: 'cancel-recurring', recurringPaymentId: '0199e0a4-0000-7000-8000-0000000a0002' },
    ]);
    expect(normalise(duplicate!.defaultBody)).toContain(
      '«Netflix Premium» ahorrarías 6,99 € al mes',
    );
  });

  it('a yearly subscription counts a twelfth per month', () => {
    const [duplicate] = detectAll(yearlyDuplicate);
    expect(monthlyCost(yearlyDuplicate.recurring[0]!)).toBe(416);
    // Keeps the monthly one (4,99 €) and drops the yearly (4,16 € a month).
    expect(duplicate?.potentialMonthlySavingsMinor).toBe(416);
  });

  it('exceeded budgets show limit, spent and the excess', () => {
    const [exceeded] = byKind('budget-exceeded');
    expect(exceeded?.evidence.map((e) => e.amountMinor)).toEqual([40_000, 43_500, 3_500]);
    expect(exceeded?.defaultTitle).toBe('Presupuesto de Comida superado');
  });

  it('expensive debts: only above 10 %, with the extra payment simulated by @icount/finance', () => {
    const debts = byKind('expensive-debt');
    expect(debts).toHaveLength(1); // the mortgage at 2,9 % is not expensive
    expect(suggestedExtraPayment(12_000)).toBe(2_000);
    expect(debts[0]?.actions).toEqual([
      {
        type: 'extra-debt-payment',
        debtId: '0199e0a4-0000-7000-8000-0000000d0001',
        extraMonthlyMinor: 2_000,
      },
    ]);
    expect(debts[0]?.evidence.at(-1)?.amountMinor).toBeGreaterThan(0);
    expect(debts[0]?.facts[0]).toBe('21,9 %');
  });

  it('unusual spending compares last month with the three before', () => {
    const [unusual] = byKind('unusual-spending');
    // Average of 110, 125 and 125 € = 120 €; last month 310 € → 190 € more.
    expect(unusual?.evidence.map((e) => e.amountMinor)).toEqual([12_000, 31_000, 19_000]);
    expect(unusual?.actions[0]).toEqual({
      type: 'set-budget',
      categoryId: 'leisure',
      month: '2026-10',
      limitMinor: 12_000,
    });
  });

  it('a tidy household has nothing to report', () => {
    expect(detectAll(tidyFlat)).toEqual([]);
  });
});

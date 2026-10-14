import { Money } from '@/core/domain/Money';

import type { Debt } from '../Debt';
import {
  installmentDate,
  nextInstallmentDate,
  paidRatio,
  remainingInstallments,
  summarizeDebts,
} from '../debtMath';
import { formatRate, parseRateInput } from '../parseRateInput';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : null;

const debt = (extra: Partial<Debt> = {}): Debt => ({
  id: 'd1',
  householdId: 'h',
  name: 'Coche',
  kind: 'car',
  principal: eur(1_200_000),
  outstanding: eur(900_000),
  annualRateBps: 690,
  aprBps: null,
  monthlyPayment: eur(23_700),
  startDate: new Date(2026, 0, 15),
  termMonths: 12,
  endDate: new Date(2026, 11, 15),
  ...extra,
});

describe('installmentDate', () => {
  it('keeps the day of the first instalment month after month', () => {
    expect(ymd(installmentDate(debt(), 0))).toBe('2026-01-15');
    expect(ymd(installmentDate(debt(), 5))).toBe('2026-06-15');
    expect(ymd(installmentDate(debt(), 12))).toBe('2027-01-15');
  });

  it('an instalment on the 31st falls on the last day of short months and comes back', () => {
    const d = debt({ startDate: new Date(2026, 0, 31) });
    expect(ymd(installmentDate(d, 1))).toBe('2026-02-28');
    expect(ymd(installmentDate(d, 2))).toBe('2026-03-31');
    expect(ymd(installmentDate(d, 3))).toBe('2026-04-30');
  });

  it('knows leap Februaries', () => {
    expect(ymd(installmentDate(debt({ startDate: new Date(2028, 0, 31) }), 1))).toBe('2028-02-29');
  });
});

describe('nextInstallmentDate / remainingInstallments', () => {
  it('is the first instalment on or after today (today counts)', () => {
    expect(ymd(nextInstallmentDate(debt(), new Date(2026, 3, 15)))).toBe('2026-04-15');
    expect(ymd(nextInstallmentDate(debt(), new Date(2026, 3, 16)))).toBe('2026-05-15');
    expect(ymd(nextInstallmentDate(debt(), new Date(2026, 3, 1)))).toBe('2026-04-15');
  });

  it('before the first instalment it is the first one', () => {
    expect(ymd(nextInstallmentDate(debt(), new Date(2025, 5, 1)))).toBe('2026-01-15');
  });

  it('after the last one there is none', () => {
    expect(nextInstallmentDate(debt(), new Date(2026, 11, 16))).toBeNull();
    expect(nextInstallmentDate(debt(), new Date(2030, 0, 1))).toBeNull();
  });

  it('counts the instalments left, today included', () => {
    expect(remainingInstallments(debt(), new Date(2025, 0, 1))).toBe(12);
    expect(remainingInstallments(debt(), new Date(2026, 5, 15))).toBe(7); // Jun … Dec
    expect(remainingInstallments(debt(), new Date(2026, 5, 16))).toBe(6);
    expect(remainingInstallments(debt(), new Date(2027, 0, 1))).toBe(0);
  });
});

describe('paidRatio', () => {
  it('is the share of the principal already paid', () => {
    expect(paidRatio(debt())).toBe(0.25);
    expect(paidRatio(debt({ outstanding: eur(0) }))).toBe(1);
    expect(paidRatio(debt({ outstanding: eur(1_200_000) }))).toBe(0);
  });

  it('never leaves 0..1 and tolerates a zero principal', () => {
    expect(paidRatio(debt({ outstanding: eur(2_000_000) }))).toBe(0);
    expect(paidRatio(debt({ principal: eur(0), outstanding: eur(0) }))).toBe(1);
  });
});

describe('summarizeDebts', () => {
  it('adds what is owed and the instalments of the debts still alive', () => {
    const totals = summarizeDebts(
      [debt(), debt({ id: 'd2', outstanding: eur(100_000), monthlyPayment: eur(10_000) })],
      'EUR',
    );
    expect(totals.outstanding.amountMinor).toBe(1_000_000);
    expect(totals.monthlyPayments.amountMinor).toBe(33_700);
    expect(totals.count).toBe(2);
  });

  it('ignores paid-off debts', () => {
    const totals = summarizeDebts([debt({ outstanding: eur(0) })], 'EUR');
    expect(totals.count).toBe(0);
    expect(totals.outstanding.amountMinor).toBe(0);
    expect(totals.monthlyPayments.amountMinor).toBe(0);
  });
});

describe('parseRateInput / formatRate', () => {
  it.each([
    ['6,9', 690],
    ['6.9', 690],
    ['6,90', 690],
    ['21', 2_100],
    ['0', 0],
    ['0,05', 5],
    [',5', 50],
    ['5,', 500],
    ['100', 10_000],
    [' 3,25 % ', 325],
  ])('reads %j as %i basis points', (raw, bps) => {
    expect(parseRateInput(raw)).toEqual({ ok: true, bps });
  });

  it.each([
    ['', 'empty'],
    ['  ', 'empty'],
    ['abc', 'invalid'],
    ['1,2,3', 'invalid'],
    ['-5', 'invalid'],
    ['.', 'invalid'],
    ['6,999', 'too-many-decimals'],
    ['100,01', 'too-large'],
    ['150', 'too-large'],
  ])('rejects %j as %s', (raw, reason) => {
    expect(parseRateInput(raw)).toEqual({ ok: false, reason });
  });

  it('formats basis points as a percentage with two decimals', () => {
    expect(formatRate(690)).toBe('6,90 %');
    expect(formatRate(2_100)).toBe('21,00 %');
    expect(formatRate(0)).toBe('0,00 %');
    expect(formatRate(5)).toBe('0,05 %');
  });
});

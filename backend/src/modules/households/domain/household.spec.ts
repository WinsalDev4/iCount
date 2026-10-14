import { Household } from './household.js';
import {
  AlreadyMemberError,
  CurrencyMismatchError,
  InvalidSplitRuleError,
  NotHouseholdAdminError,
  PersonalHouseholdError,
} from './households.errors.js';

const now = new Date('2026-10-14T10:00:00Z');
const ana = { userId: 'ana', email: 'ana@icount.app', displayName: 'Ana' };
const leo = { userId: 'leo', email: 'leo@icount.app', displayName: null };

const shared = () =>
  Household.create({ id: 'h1', name: 'Piso', kind: 'shared', currency: 'EUR', creator: ana, now });

describe('Household', () => {
  it('makes the creator admin and starts splitting equally', () => {
    const household = shared();

    expect(household.members).toEqual([
      expect.objectContaining({ userId: 'ana', role: 'admin', monthlyIncomeMinor: null }),
    ]);
    expect(household.splitRule).toEqual({ type: 'equal' });
  });

  it('adds members once, and never to a personal household', () => {
    const household = shared();
    household.addMember(leo, now);

    expect(household.members.map((m) => [m.userId, m.role])).toEqual([
      ['ana', 'admin'],
      ['leo', 'member'],
    ]);
    expect(() => household.addMember(leo, now)).toThrow(AlreadyMemberError);

    const personal = Household.create({
      id: 'h2',
      name: 'Yo',
      kind: 'personal',
      currency: 'EUR',
      creator: ana,
      now,
    });
    expect(() => personal.addMember(leo, now)).toThrow(PersonalHouseholdError);
  });

  it('lets only admins change the split rule', () => {
    const household = shared();
    household.addMember(leo, now);

    expect(() => household.setSplitRule('leo', { type: 'income-proportional' })).toThrow(
      NotHouseholdAdminError,
    );
    household.setSplitRule('ana', { type: 'income-proportional' });
    expect(household.splitRule.type).toBe('income-proportional');
  });

  it('validates custom shares against the members', () => {
    const household = shared();
    household.addMember(leo, now);
    const custom = (shares: { memberId: string; basisPoints: number }[]) => ({
      type: 'custom' as const,
      categories: [{ categoryId: 'housing', shares }],
    });

    household.setSplitRule(
      'ana',
      custom([
        { memberId: 'ana', basisPoints: 6_000 },
        { memberId: 'leo', basisPoints: 4_000 },
      ]),
    );
    expect(() =>
      household.setSplitRule('ana', custom([{ memberId: 'stranger', basisPoints: 10_000 }])),
    ).toThrow(InvalidSplitRuleError);
    expect(() =>
      household.setSplitRule('ana', custom([{ memberId: 'ana', basisPoints: 9_000 }])),
    ).toThrow(InvalidSplitRuleError);
  });

  it('records incomes in the household currency', () => {
    const household = shared();

    household.setMemberIncome('ana', 245_000, 'EUR');
    expect(household.members[0]!.monthlyIncomeMinor).toBe(245_000);
    expect(() => household.setMemberIncome('ana', 100, 'USD')).toThrow(CurrencyMismatchError);
  });
});

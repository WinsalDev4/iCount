import { Household } from '../../households/domain/household.js';
import { InvalidSettlementError, Settlement } from './settlement.js';

const now = new Date('2026-10-14T10:00:00Z');
const household = Household.create({
  id: 'h1',
  name: 'Piso',
  kind: 'shared',
  currency: 'EUR',
  creator: { userId: 'ana', email: 'ana@icount.app', displayName: null },
  now,
});
household.addMember({ userId: 'leo', email: 'leo@icount.app', displayName: null }, now);

const base = {
  id: 's1',
  householdId: 'h1',
  fromMemberId: 'leo',
  toMemberId: 'ana',
  amountMinor: 3_000,
  currency: 'EUR',
  method: 'bizum' as const,
  note: '',
  settledOn: '2026-10-12',
  createdBy: 'leo',
  createdAt: now,
};

describe('Settlement', () => {
  it('records a payment between two members', () => {
    expect(Settlement.create(household, base).snapshot.amountMinor).toBe(3_000);
  });

  it.each([
    ['paying oneself', { toMemberId: 'leo' }],
    ['someone outside the household', { toMemberId: 'mallory' }],
    ['a zero amount', { amountMinor: 0 }],
    ['fractions of a cent', { amountMinor: 10.5 }],
    ['another currency', { currency: 'USD' }],
    ['a long note', { note: 'x'.repeat(141) }],
  ])('rejects %s', (_case, change) => {
    expect(() => Settlement.create(household, { ...base, ...change })).toThrow(
      InvalidSettlementError,
    );
  });
});

import { Household } from '../../households/domain/household.js';
import {
  InvalidTransactionError,
  NotSharedHouseholdError,
  PayerNotMemberError,
  Transaction,
} from './transaction.js';

const now = new Date('2026-10-14T10:00:00Z');
const ana = { userId: 'ana', email: 'ana@icount.app', displayName: 'Ana' };
const leo = { userId: 'leo', email: 'leo@icount.app', displayName: 'Leo' };

function sharedHousehold() {
  const household = Household.create({
    id: 'h1',
    name: 'Piso',
    kind: 'shared',
    currency: 'EUR',
    creator: ana,
    now,
  });
  household.addMember(leo, now);
  return household;
}

const base = {
  id: 't1',
  type: 'expense' as const,
  amountMinor: 1_001,
  currency: 'EUR',
  categoryId: 'bills',
  description: 'Luz',
  occurredOn: '2026-10-06',
  payerId: 'ana',
  shared: true,
  createdBy: 'ana',
  now,
};

describe('Transaction', () => {
  it('computes shares with the household rule; the odd cent goes to the payer', () => {
    const transaction = Transaction.create(sharedHousehold(), base);

    expect(transaction.snapshot.shares).toEqual([
      { memberId: 'ana', amountMinor: 501 },
      { memberId: 'leo', amountMinor: 500 },
    ]);
  });

  it('has no shares when not shared', () => {
    const transaction = Transaction.create(sharedHousehold(), { ...base, shared: false });
    expect(transaction.snapshot.shares).toEqual([]);
  });

  it('recomputes shares when edited', () => {
    const household = sharedHousehold();
    const transaction = Transaction.create(household, base);

    transaction.edit(household, { amountMinor: 2_001, payerId: 'leo' }, now);

    expect(transaction.snapshot.shares).toEqual([
      { memberId: 'ana', amountMinor: 1_000 },
      { memberId: 'leo', amountMinor: 1_001 },
    ]);
  });

  it('enforces its invariants', () => {
    const household = sharedHousehold();
    expect(() => Transaction.create(household, { ...base, amountMinor: 0 })).toThrow(
      InvalidTransactionError,
    );
    expect(() => Transaction.create(household, { ...base, payerId: 'stranger' })).toThrow(
      PayerNotMemberError,
    );
    expect(() => Transaction.create(household, { ...base, currency: 'USD' })).toThrow(
      InvalidTransactionError,
    );

    const personal = Household.create({
      id: 'h2',
      name: 'Yo',
      kind: 'personal',
      currency: 'EUR',
      creator: ana,
      now,
    });
    expect(() => Transaction.create(personal, base)).toThrow(NotSharedHouseholdError);
  });
});

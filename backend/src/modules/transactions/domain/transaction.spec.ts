import { Household } from '../../households/domain/household.js';
import {
  AlreadyDecidedError,
  CannotApproveOwnError,
  InvalidTransactionError,
  NotAnApproverError,
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

  describe('approval (ADR-0016)', () => {
    const marta = { userId: 'marta', email: 'marta@icount.app', displayName: 'Marta' };
    const later = new Date('2026-10-15T10:00:00Z');
    function threeMembers() {
      const household = sharedHousehold();
      household.addMember(marta, now);
      return household;
    }

    it('a shared movement waits for the other members; a private one does not', () => {
      const household = threeMembers();
      const shared = Transaction.create(household, base);
      expect(shared.snapshot.approvalStatus).toBe('pending');
      expect(shared.approvers).toEqual(['leo', 'marta']);
      expect(shared.counts).toBe(false);

      const own = Transaction.create(household, { ...base, shared: false });
      expect(own.snapshot.approvalStatus).toBeNull();
      expect(own.counts).toBe(true);
    });

    it('is approved when every other member approves', () => {
      const transaction = Transaction.create(threeMembers(), base);

      transaction.decide('leo', 'approve', null, later);
      expect(transaction.snapshot.approvalStatus).toBe('pending');
      transaction.decide('marta', 'approve', null, later);

      expect(transaction.snapshot.approvalStatus).toBe('approved');
      expect(transaction.counts).toBe(true);
    });

    it('one rejection (with a reason) is enough to reject it', () => {
      const transaction = Transaction.create(threeMembers(), base);

      expect(() => transaction.decide('leo', 'reject', '  ', later)).toThrow(
        InvalidTransactionError,
      );
      transaction.decide('leo', 'reject', ' No fue compartido ', later);

      expect(transaction.snapshot.approvalStatus).toBe('rejected');
      expect(transaction.snapshot.approvals[0]?.reason).toBe('No fue compartido');
      expect(() => transaction.decide('marta', 'approve', null, later)).toThrow(
        AlreadyDecidedError,
      );
    });

    it('nobody approves their own movement, decides twice or decides on what is not theirs', () => {
      const household = threeMembers();
      const transaction = Transaction.create(household, base);

      expect(() => transaction.decide('ana', 'approve', null, later)).toThrow(
        CannotApproveOwnError,
      );
      expect(() => transaction.decide('stranger', 'approve', null, later)).toThrow(
        NotAnApproverError,
      );
      transaction.decide('leo', 'approve', null, later);
      expect(() => transaction.decide('leo', 'approve', null, later)).toThrow(AlreadyDecidedError);
    });

    it('an edit starts a new approval round', () => {
      const household = threeMembers();
      const transaction = Transaction.create(household, base);
      transaction.decide('leo', 'approve', null, later);
      transaction.decide('marta', 'approve', null, later);

      transaction.edit(household, { amountMinor: 2_000 }, later);

      expect(transaction.snapshot.approvalStatus).toBe('pending');
      expect(transaction.snapshot.approvals).toEqual([]);
    });
  });
});

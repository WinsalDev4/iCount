import { suggestTransfers } from '@icount/finance';

import type { UserId } from '@/core/domain/Ids';
import { Money, type CurrencyCode } from '@/core/domain/Money';
import type { Member } from '@/features/household/domain/Household';
import { previewSplit } from '@/features/household/domain/previewSplit';
import type { SplitRule } from '@/features/household/domain/SplitRule';
import type { Transaction } from '@/features/transactions/domain/Transaction';

import type { HouseholdBalance, MemberBalance, Settlement } from './Settlement';

export interface BalanceInput {
  readonly members: readonly Member[];
  readonly rule: SplitRule;
  readonly currency: CurrencyCode;
  /** Shared movements that count: the APPROVED ones, already filtered by period. */
  readonly transactions: readonly Transaction[];
  readonly settlements: readonly Settlement[];
  readonly pendingApprovalCount: number;
}

const memberLabel = (member: Member) => member.displayName ?? member.email;

/**
 * Net position of each member (ADR-0016): `net = paid − owed`, in whole cents. The nets of a
 * household add up to exactly zero because every split adds up to its amount and a settlement
 * adds the same to the sender's `paid` and to the receiver's `owed`.
 *
 * - Shared expense: the payer `paid` its amount; every member `owes` their share.
 * - Shared income (a refund): same with the sign reversed.
 * - Settlement `from → to`: counts as `paid` for `from` and as `owed` for `to`.
 * Movements whose payer left the household are ignored.
 */
export function computeBalance(input: BalanceInput): HouseholdBalance {
  const { members, currency } = input;
  const paid = new Map<string, number>(members.map((m) => [m.userId as string, 0]));
  const owed = new Map<string, number>(members.map((m) => [m.userId as string, 0]));
  const previewMembers = members.map((m) => ({
    id: m.userId as string,
    label: memberLabel(m),
    monthlyIncome: m.monthlyIncome,
  }));

  for (const tx of input.transactions) {
    if (!tx.shared || !paid.has(tx.payerId)) continue;
    const sign = tx.type === 'expense' ? 1 : -1;
    const shares =
      tx.shares.length > 0
        ? tx.shares.map((s) => ({ memberId: s.memberId as string, minor: s.amount.amountMinor }))
        : previewSplit(input.rule, previewMembers, tx.amount, tx.categoryId).shares.map((s) => ({
            memberId: s.memberId,
            minor: s.amount.amountMinor,
          }));
    paid.set(tx.payerId, (paid.get(tx.payerId) ?? 0) + sign * tx.amount.amountMinor);
    for (const share of shares) {
      owed.set(share.memberId, (owed.get(share.memberId) ?? 0) + sign * share.minor);
    }
  }

  for (const settlement of input.settlements) {
    if (!paid.has(settlement.from) || !paid.has(settlement.to)) continue;
    paid.set(settlement.from, (paid.get(settlement.from) ?? 0) + settlement.amount.amountMinor);
    owed.set(settlement.to, (owed.get(settlement.to) ?? 0) + settlement.amount.amountMinor);
  }

  const memberBalances: MemberBalance[] = members.map((m) => {
    const id = m.userId as string;
    const p = paid.get(id) ?? 0;
    const o = owed.get(id) ?? 0;
    return {
      memberId: m.userId,
      paid: Money.ofMinor(p, currency),
      owed: Money.ofMinor(o, currency),
      net: Money.ofMinor(p - o, currency),
    };
  });

  const suggestedTransfers = suggestTransfers(
    memberBalances.map((b) => ({ memberId: b.memberId, netMinor: b.net.amountMinor })),
  ).map((t) => ({
    from: t.fromMemberId as UserId,
    to: t.toMemberId as UserId,
    amount: Money.ofMinor(t.amountMinor, currency),
  }));

  return {
    members: memberBalances,
    suggestedTransfers,
    pendingApprovalCount: input.pendingApprovalCount,
  };
}

/**
 * Settling a shared household (ADR-0016): from each member's net position
 * (`paid − owed`, in cents, adding up to zero) to the transfers that bring
 * everybody to zero.
 */

export interface MemberNet {
  readonly memberId: string;
  /** Positive: the others owe them. Negative: they owe. */
  readonly netMinor: number;
}

export interface SuggestedTransfer {
  readonly fromMemberId: string;
  readonly toMemberId: string;
  readonly amountMinor: number;
}

export class UnbalancedNetsError extends Error {
  constructor(sumMinor: number) {
    super(`The nets of a household must add up to 0 (they add up to ${sumMinor}).`);
    this.name = 'UnbalancedNetsError';
  }
}

/**
 * Greedy settlement: the largest debtor pays the largest creditor
 * `min(debt, credit)`; whoever reaches zero leaves; repeat. At most n − 1
 * transfers, all in whole cents. Ties are broken by member id so the result is
 * deterministic (the app and the API suggest the same transfers).
 *
 * The exact minimum is NP-hard (zero-sum subset partition); for a household of
 * 2–6 people the greedy one is optimal or one transfer away.
 */
export function suggestTransfers(nets: readonly MemberNet[]): SuggestedTransfer[] {
  for (const { netMinor } of nets) {
    if (!Number.isSafeInteger(netMinor)) throw new RangeError('Nets must be whole cents.');
  }
  const sum = nets.reduce((total, { netMinor }) => total + netMinor, 0);
  if (sum !== 0) throw new UnbalancedNetsError(sum);

  const byAmountThenId = (a: Position, b: Position) =>
    b.amount - a.amount || (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0);
  const debtors: Position[] = nets
    .filter(({ netMinor }) => netMinor < 0)
    .map(({ memberId, netMinor }) => ({ memberId, amount: -netMinor }));
  const creditors: Position[] = nets
    .filter(({ netMinor }) => netMinor > 0)
    .map(({ memberId, netMinor }) => ({ memberId, amount: netMinor }));

  const transfers: SuggestedTransfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmountThenId);
    creditors.sort(byAmountThenId);
    const debtor = debtors[0]!;
    const creditor = creditors[0]!;
    const amountMinor = Math.min(debtor.amount, creditor.amount);
    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountMinor,
    });
    debtor.amount -= amountMinor;
    creditor.amount -= amountMinor;
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }
  return transfers;
}

interface Position {
  readonly memberId: string;
  amount: number;
}

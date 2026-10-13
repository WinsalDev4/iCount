import { assertCents } from './rounding.ts';

/** Mirrors the household SplitRule of the contracts (basis points: 10 000 = 100 %). */
export type SplitRuleInput =
  | { readonly type: 'equal' }
  | { readonly type: 'income-proportional' }
  | {
      readonly type: 'custom';
      readonly categories: readonly {
        readonly categoryId: string;
        readonly shares: readonly { readonly memberId: string; readonly basisPoints: number }[];
      }[];
    };

export interface SplitMember {
  readonly id: string;
  /** Declared monthly income in cents; null when not declared. */
  readonly monthlyIncomeMinor: number | null;
}

export interface SplitInput {
  readonly amountMinor: number;
  /** Receives the cents that do not divide evenly. Must be one of `members`. */
  readonly payerId: string;
  readonly members: readonly SplitMember[];
  readonly rule: SplitRuleInput;
  readonly categoryId: string;
}

export interface MemberShareAmount {
  readonly memberId: string;
  readonly amountMinor: number;
}

/**
 * Splits a shared amount between members (ADR-0016):
 * - `equal`: same part for everyone;
 * - `income-proportional`: ∝ declared income (falls back to equal if anyone has
 *   not declared it or the total is 0, instead of making someone pay everything);
 * - `custom`: the category's basis points (members not listed pay 0); categories
 *   without a custom split are split equally.
 * Each part is floored and **the leftover cents go to the payer**, so the parts
 * always add up to the amount exactly. Results keep the order of `members`.
 */
export function splitAmount(input: SplitInput): MemberShareAmount[] {
  assertCents(input.amountMinor, 'amountMinor');
  if (input.amountMinor < 0) throw new RangeError('amountMinor cannot be negative');
  if (!input.members.some((member) => member.id === input.payerId)) {
    throw new RangeError(`Payer ${input.payerId} is not a member`);
  }

  const weights = weightsFor(input);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n);
  const amount = BigInt(input.amountMinor);
  // BigInt: amount × income can exceed 2^53 even when both fit comfortably.
  const parts = weights.map((weight) =>
    totalWeight === 0n ? 0n : (amount * weight) / totalWeight,
  );
  const leftover = amount - parts.reduce((sum, part) => sum + part, 0n);

  return input.members.map((member, index) => ({
    memberId: member.id,
    amountMinor: Number(parts[index]! + (member.id === input.payerId ? leftover : 0n)),
  }));
}

function weightsFor({ rule, members, categoryId }: SplitInput): bigint[] {
  const equal = members.map(() => 1n);

  if (rule.type === 'income-proportional') {
    const incomes = members.map((member) => member.monthlyIncomeMinor);
    const total = incomes.reduce<number>((sum, income) => sum + (income ?? 0), 0);
    if (incomes.some((income) => income === null) || total === 0) return equal;
    return incomes.map((income) => BigInt(income ?? 0));
  }

  if (rule.type === 'custom') {
    const custom = rule.categories.find((category) => category.categoryId === categoryId);
    if (!custom) return equal;
    return members.map((member) =>
      BigInt(custom.shares.find((share) => share.memberId === member.id)?.basisPoints ?? 0),
    );
  }

  return equal;
}

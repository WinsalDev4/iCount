import type { CategoryId } from '@/core/domain/Category';
import type { UserId } from '@/core/domain/Ids';

/** 100 % in basis points: shares are integers, never floats (ADR-0007 spirit). */
export const FULL_SHARE_BASIS_POINTS = 10_000;

export interface MemberShare {
  readonly memberId: UserId;
  /** 5_000 = 50 %. */
  readonly basisPoints: number;
}

export interface CategorySplit {
  readonly categoryId: CategoryId;
  readonly shares: readonly MemberShare[];
}

/**
 * How shared expenses are divided between members:
 * - `equal`: same part for everyone.
 * - `income-proportional`: in proportion to each member's declared monthly income.
 * - `custom`: explicit shares per category; categories not listed are split equally.
 */
export type SplitRule =
  | { readonly kind: 'equal' }
  | { readonly kind: 'income-proportional' }
  | { readonly kind: 'custom'; readonly categories: readonly CategorySplit[] };

/** Invariant of a custom split: integer shares, one per member, adding up to 100 %. */
export function isValidShares(shares: readonly MemberShare[]): boolean {
  const members = new Set(shares.map((share) => share.memberId));
  const total = shares.reduce((sum, share) => sum + share.basisPoints, 0);
  return (
    shares.length > 0 &&
    members.size === shares.length &&
    shares.every((share) => Number.isInteger(share.basisPoints) && share.basisPoints >= 0) &&
    total === FULL_SHARE_BASIS_POINTS
  );
}

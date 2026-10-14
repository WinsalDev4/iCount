import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import { allocate } from './allocate';
import { FULL_SHARE_BASIS_POINTS, type SplitRule } from './SplitRule';

export interface PreviewMember {
  readonly id: string;
  readonly label: string;
  /** Declared monthly income; needed by the income-proportional rule. */
  readonly monthlyIncome: Money | null;
}

export interface PreviewShare {
  readonly memberId: string;
  readonly label: string;
  readonly amount: Money;
  /** Share of the expense in basis points (5_000 = 50 %), after rounding to whole cents. */
  readonly basisPoints: number;
}

export interface SplitPreview {
  readonly shares: readonly PreviewShare[];
  /**
   * Why the result is not what the rule literally says, if so: `income-missing` means the
   * proportional rule could not be applied (somebody's income is unknown) so it is equal.
   */
  readonly fallback: 'income-missing' | null;
}

/**
 * What each member would pay for ONE expense under a rule. It is the preview of the setup
 * screens; the real split of every expense is computed by the same rules on the server.
 */
export function previewSplit(
  rule: SplitRule,
  members: readonly PreviewMember[],
  expense: Money,
  categoryId?: CategoryId,
): SplitPreview {
  const { weights, fallback } = weightsFor(rule, members, categoryId);
  const amounts = allocate(expense.amountMinor, weights);
  const total = Math.abs(expense.amountMinor);

  const shares = members.map((member, index) => {
    const minor = amounts[index] ?? 0;
    return {
      memberId: member.id,
      label: member.label,
      amount: Money.ofMinor(minor, expense.currency),
      basisPoints:
        total === 0 ? 0 : Math.round((Math.abs(minor) * FULL_SHARE_BASIS_POINTS) / total),
    };
  });
  return { shares, fallback };
}

function weightsFor(
  rule: SplitRule,
  members: readonly PreviewMember[],
  categoryId?: CategoryId,
): { weights: number[]; fallback: SplitPreview['fallback'] } {
  const equal = members.map(() => 1);

  switch (rule.kind) {
    case 'equal':
      return { weights: equal, fallback: null };

    case 'income-proportional': {
      const incomes = members.map((m) => m.monthlyIncome?.amountMinor ?? 0);
      const allKnown = members.every((m) => m.monthlyIncome !== null);
      const total = incomes.reduce((a, b) => a + b, 0);
      if (!allKnown || total <= 0) return { weights: equal, fallback: 'income-missing' };
      return { weights: incomes, fallback: null };
    }

    case 'custom': {
      const split = categoryId
        ? rule.categories.find((category) => category.categoryId === categoryId)
        : undefined;
      // Categories without an explicit split are shared equally (see SplitRule).
      if (!split) return { weights: equal, fallback: null };
      return {
        weights: members.map(
          (m) => split.shares.find((share) => share.memberId === m.id)?.basisPoints ?? 0,
        ),
        fallback: null,
      };
    }
  }
}

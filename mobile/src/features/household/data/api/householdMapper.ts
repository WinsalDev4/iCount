import type { HouseholdDto, InvitationDto, SplitRule as SplitRuleDto } from '@icount/contracts';

import type { CategoryId } from '@/core/domain/Category';
import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';

import type { Household, Invitation } from '../../domain/Household';
import type { SplitRule } from '../../domain/SplitRule';

/**
 * DTO ↔ domain. The contract speaks JSON (`type`, plain strings, `{ amountMinor }`);
 * the domain speaks the app's language (`kind`, branded ids, `Money`, `Date`).
 */
export function toHousehold(dto: HouseholdDto): Household {
  return {
    id: dto.id as string as HouseholdId,
    name: dto.name,
    kind: dto.kind,
    currency: dto.currency,
    splitRule: toSplitRule(dto.splitRule),
    members: dto.members.map((member) => ({
      userId: member.userId as string as UserId,
      email: member.email,
      displayName: member.displayName,
      role: member.role,
      monthlyIncome: member.monthlyIncome
        ? Money.ofMinor(member.monthlyIncome.amountMinor, member.monthlyIncome.currency)
        : null,
    })),
  };
}

export function toSplitRule(dto: SplitRuleDto): SplitRule {
  switch (dto.type) {
    case 'equal':
    case 'income-proportional':
      return { kind: dto.type };
    case 'custom':
      return {
        kind: 'custom',
        categories: dto.categories.map((category) => ({
          categoryId: category.categoryId as CategoryId,
          shares: category.shares.map((share) => ({
            memberId: share.memberId as string as UserId,
            basisPoints: share.basisPoints,
          })),
        })),
      };
  }
}

/** Domain → request body (validated again by the API with the same contract). */
export function fromSplitRule(rule: SplitRule): unknown {
  switch (rule.kind) {
    case 'equal':
    case 'income-proportional':
      return { type: rule.kind };
    case 'custom':
      return {
        type: 'custom',
        categories: rule.categories.map((category) => ({
          categoryId: category.categoryId,
          shares: category.shares.map((share) => ({
            memberId: share.memberId,
            basisPoints: share.basisPoints,
          })),
        })),
      };
  }
}

export function toInvitation(dto: InvitationDto): Invitation {
  return { code: dto.code, expiresAt: new Date(dto.expiresAt) };
}

import { z } from 'zod';

import { emailSchema } from './auth.ts';
import { categoryIdResponseSchema, categoryIdSchema } from './category.ts';
import { currencyCodeSchema } from './currency.ts';
import { householdIdSchema, userIdSchema } from './ids.ts';
import { moneyDtoSchema } from './money.ts';

/** 100 % expressed in basis points: integers only, never floats (ADR-0007 spirit). */
export const FULL_SHARE_BASIS_POINTS = 10_000;

export const householdKindSchema = z.enum(['personal', 'shared']);
export const memberRoleSchema = z.enum(['admin', 'member']);

export const memberShareSchema = z.object({
  memberId: userIdSchema,
  basisPoints: z.int().min(0).max(FULL_SHARE_BASIS_POINTS),
});

const sharesSchema = z
  .array(memberShareSchema)
  .min(1)
  .refine((shares) => new Set(shares.map((s) => s.memberId)).size === shares.length, {
    message: 'Each member can appear only once',
  })
  .refine(
    (shares) => shares.reduce((sum, s) => sum + s.basisPoints, 0) === FULL_SHARE_BASIS_POINTS,
    { message: `Shares must add up to ${FULL_SHARE_BASIS_POINTS} basis points (100 %)` },
  );

function categorySplitSchema(
  categoryId: typeof categoryIdSchema | typeof categoryIdResponseSchema,
) {
  return z.object({ categoryId, shares: sharesSchema });
}

function customSplitRuleSchema(
  categoryId: typeof categoryIdSchema | typeof categoryIdResponseSchema,
) {
  return z.object({
    type: z.literal('custom'),
    /** Categories not listed fall back to equal parts. */
    categories: z
      .array(categorySplitSchema(categoryId))
      .refine(
        (categories) => new Set(categories.map((c) => c.categoryId)).size === categories.length,
        { message: 'Each category can appear only once' },
      ),
  });
}

const equalSplitRuleSchema = z.object({ type: z.literal('equal') });
/** Each member pays in proportion to their declared monthly income. */
const incomeProportionalSplitRuleSchema = z.object({ type: z.literal('income-proportional') });

/** How shared expenses are divided. Strict version: for requests. */
export const splitRuleSchema = z.discriminatedUnion('type', [
  equalSplitRuleSchema,
  incomeProportionalSplitRuleSchema,
  customSplitRuleSchema(categoryIdSchema),
]);

/** Tolerant reader for responses (unknown categories read as `other`). */
export const splitRuleResponseSchema = z.discriminatedUnion('type', [
  equalSplitRuleSchema,
  incomeProportionalSplitRuleSchema,
  customSplitRuleSchema(categoryIdResponseSchema),
]);

export const memberDtoSchema = z.object({
  userId: userIdSchema,
  email: emailSchema,
  displayName: z.string().min(1).max(60).nullable(),
  role: memberRoleSchema,
  /** Declared monthly income, used by the income-proportional rule. */
  monthlyIncome: moneyDtoSchema.nullable(),
  joinedAt: z.iso.datetime(),
});

export const householdNameSchema = z.string().trim().min(1).max(60);

export const householdDtoSchema = z.object({
  id: householdIdSchema,
  name: householdNameSchema,
  kind: householdKindSchema,
  currency: currencyCodeSchema,
  splitRule: splitRuleResponseSchema,
  members: z.array(memberDtoSchema).min(1),
  createdAt: z.iso.datetime(),
});

/**
 * Invite codes: 8 characters without look-alikes (no 0/O, 1/I/L), easy to
 * dictate. Input is normalised: `abcd 2345` → `ABCD2345`.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const inviteCodeSchema = z
  .string()
  .transform((code) => code.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-HJKMNP-Z2-9]{8}$/, 'Invalid invite code'));

/** POST /v1/households → HouseholdDto (the creator becomes admin). */
export const createHouseholdRequestSchema = z.object({
  name: householdNameSchema,
  kind: householdKindSchema,
  currency: currencyCodeSchema.default('EUR'),
});

/** POST /v1/households/:id/invitations → InvitationDto (48 h, single use). */
export const invitationDtoSchema = z.object({
  code: inviteCodeSchema,
  householdId: householdIdSchema,
  expiresAt: z.iso.datetime(),
});

/** POST /v1/households/join → HouseholdDto. */
export const joinHouseholdRequestSchema = z.object({ code: inviteCodeSchema });

/** PUT /v1/households/:id/split-rule → HouseholdDto (admin only). */
export const setSplitRuleRequestSchema = z.object({ splitRule: splitRuleSchema });

/** PUT /v1/households/:id/members/me/income → HouseholdDto. */
export const setMemberIncomeRequestSchema = z.object({
  monthlyIncome: moneyDtoSchema.refine((money) => money.amountMinor >= 0, {
    message: 'Income cannot be negative',
  }),
});

export type HouseholdKind = z.infer<typeof householdKindSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type MemberShare = z.infer<typeof memberShareSchema>;
export type SplitRule = z.infer<typeof splitRuleSchema>;
export type MemberDto = z.infer<typeof memberDtoSchema>;
export type HouseholdDto = z.infer<typeof householdDtoSchema>;
export type InvitationDto = z.infer<typeof invitationDtoSchema>;
export type CreateHouseholdRequest = z.infer<typeof createHouseholdRequestSchema>;
export type JoinHouseholdRequest = z.infer<typeof joinHouseholdRequestSchema>;
export type SetSplitRuleRequest = z.infer<typeof setSplitRuleRequestSchema>;
export type SetMemberIncomeRequest = z.infer<typeof setMemberIncomeRequestSchema>;

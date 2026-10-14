import { z } from 'zod';

import { userIdSchema } from './ids.ts';

/**
 * Passwordless auth (ADR-0013): magic link → access JWT (15 min) + rotating
 * refresh token. Tokens are opaque strings for clients.
 */

/** Normalised so `Ana@Mail.com ` and `ana@mail.com` are the same account. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

const opaqueTokenSchema = z.string().min(16).max(512);

/** POST /v1/auth/magic-link → 202 always (no account enumeration). */
export const requestMagicLinkRequestSchema = z.object({ email: emailSchema });

/** POST /v1/auth/verify → SessionDto. `token` comes from `icount://auth/verify?token=…`. */
export const verifyMagicLinkRequestSchema = z.object({ token: opaqueTokenSchema });

/** POST /v1/auth/refresh → SessionDto (rotated refresh token). */
export const refreshSessionRequestSchema = z.object({ refreshToken: opaqueTokenSchema });

/** POST /v1/auth/logout → 204. Revokes the whole refresh token family. */
export const logoutRequestSchema = z.object({ refreshToken: opaqueTokenSchema });

export const userDtoSchema = z.object({
  id: userIdSchema,
  email: emailSchema,
  /** Optional until the user sets it (setup step). */
  displayName: z.string().trim().min(1).max(60).nullable(),
  createdAt: z.iso.datetime(),
});

export const sessionDtoSchema = z.object({
  /** JWT for `Authorization: Bearer`. Keep it in memory only. */
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime(),
  /** Opaque, single use (rotates on refresh). Store it in SecureStore. */
  refreshToken: opaqueTokenSchema,
  user: userDtoSchema,
});

export type RequestMagicLinkRequest = z.infer<typeof requestMagicLinkRequestSchema>;
export type VerifyMagicLinkRequest = z.infer<typeof verifyMagicLinkRequestSchema>;
export type RefreshSessionRequest = z.infer<typeof refreshSessionRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type UserDto = z.infer<typeof userDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;

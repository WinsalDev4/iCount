import { z } from 'zod';

/** Expo push tokens look like `ExponentPushToken[xxxxxxxx]` (or `ExpoPushToken[…]`). */
export const expoPushTokenSchema = z
  .string()
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Not an Expo push token');

export const pushPlatformSchema = z.enum(['ios', 'android']);

/** PUT /v1/me/push-tokens → 204. Idempotent: registering the same token again just refreshes it. */
export const registerPushTokenRequestSchema = z.object({
  token: expoPushTokenSchema,
  platform: pushPlatformSchema,
  /** e.g. "Pixel 8a", to list and revoke devices. */
  deviceName: z.string().trim().max(80).optional(),
});

/** DELETE /v1/me/push-tokens → 204 (on sign-out). */
export const unregisterPushTokenRequestSchema = z.object({ token: expoPushTokenSchema });

/** Events that send a push (ADR-0017). */
export const pushEventSchema = z.enum(['shared-expense', 'approval-pending', 'settle-reminder']);

/**
 * `data` payload of every push: the app opens `url` (an Expo Router path such as
 * `/household?filter=to-review`) when the user taps the notification.
 */
export const pushDataSchema = z.object({
  event: pushEventSchema.or(z.string()),
  url: z.string().startsWith('/'),
});

export type ExpoPushToken = z.infer<typeof expoPushTokenSchema>;
export type PushPlatform = z.infer<typeof pushPlatformSchema>;
export type RegisterPushTokenRequest = z.infer<typeof registerPushTokenRequestSchema>;
export type UnregisterPushTokenRequest = z.infer<typeof unregisterPushTokenRequestSchema>;
export type PushEvent = z.infer<typeof pushEventSchema>;
export type PushData = z.infer<typeof pushDataSchema>;

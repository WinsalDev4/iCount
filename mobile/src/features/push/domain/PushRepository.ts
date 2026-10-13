export type PushPlatform = 'ios' | 'android';

/**
 * Port to tell the API which device receives this user's push notifications
 * (ADR-0017). Implementation: ApiPushRepository (A-5.2). Obtaining the token and
 * handling taps live in core/notifications.
 */
export interface PushRepository {
  /** Idempotent: registering the same token again just refreshes it. */
  register(token: string, platform: PushPlatform, deviceName?: string): Promise<void>;
  /** On sign-out, so the device stops receiving this user's notifications. */
  unregister(token: string): Promise<void>;
}

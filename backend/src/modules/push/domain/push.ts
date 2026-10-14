/**
 * Push notifications (ADR-0017). The domain only knows tokens, notifications
 * and what the delivery service answered; Expo is an adapter behind PushSender.
 */

export type PushPlatform = 'ios' | 'android';
export type PushEvent = 'shared-expense' | 'approval-pending' | 'settle-reminder';

/** What a module wants to tell some users. */
export interface PushNotification {
  readonly recipients: readonly string[];
  readonly event: PushEvent;
  readonly title: string;
  readonly body: string;
  /** Expo Router path the app opens on tap; always internal (starts with `/`). */
  readonly url: string;
}

/**
 * Port the other modules use to notify (global, like ActivityLog). Sending
 * happens after the database transaction commits and never blocks the request.
 */
export abstract class PushNotifications {
  abstract notify(notification: PushNotification): void;
}

export interface DeviceToken {
  readonly userId: string;
  readonly token: string;
}

export abstract class PushTokenRepository {
  /** Upsert by token: a device that signs in with another account moves to it. */
  abstract register(
    userId: string,
    token: string,
    platform: PushPlatform,
    deviceName: string | null,
    now: Date,
  ): Promise<void>;
  abstract unregister(userId: string, token: string): Promise<void>;
  abstract tokensOf(userIds: readonly string[]): Promise<DeviceToken[]>;
  /** Tokens the delivery service reported as no longer valid. */
  abstract remove(tokens: readonly string[]): Promise<void>;
}

/** A ticket waiting for its receipt (which says whether the device really got it). */
export interface PendingReceipt {
  readonly receiptId: string;
  readonly token: string;
}

export abstract class PushTicketRepository {
  abstract save(tickets: readonly PendingReceipt[], sentAt: Date): Promise<void>;
  /** Tickets sent before `sentBefore` (receipts take a while to be ready). */
  abstract due(sentBefore: Date, limit: number): Promise<PendingReceipt[]>;
  abstract delete(receiptIds: readonly string[]): Promise<void>;
}

export interface OutgoingPush {
  readonly token: string;
  readonly title: string;
  readonly body: string;
  readonly data: { readonly event: PushEvent; readonly url: string };
}

/** Result for one message, in the same order as sent. */
export type SendResult =
  | { readonly ok: true; readonly receiptId: string }
  | { readonly ok: false; readonly deviceNotRegistered: boolean; readonly message: string };

/** Result of a receipt; missing ids are not ready yet. */
export type ReceiptResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly deviceNotRegistered: boolean; readonly message: string };

/** Port to the delivery service (Expo Push Service; FCM/APNs could be another adapter). */
export abstract class PushSender {
  /** Sends in batches; the result array matches `messages` one to one. */
  abstract send(messages: readonly OutgoingPush[]): Promise<SendResult[]>;
  abstract receipts(receiptIds: readonly string[]): Promise<Map<string, ReceiptResult>>;
}

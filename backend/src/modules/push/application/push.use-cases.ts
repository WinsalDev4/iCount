import type { Clock } from '../../../shared/application/clock.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import {
  type OutgoingPush,
  type PushNotification,
  PushNotifications,
  type PushPlatform,
  type PushSender,
  type PushTicketRepository,
  type PushTokenRepository,
} from '../domain/push.js';

/** Receipts are usually ready within 15 minutes of sending. */
export const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_BATCH = 1_000;

export class RegisterPushToken {
  constructor(
    private readonly tokens: PushTokenRepository,
    private readonly clock: Clock,
  ) {}

  execute(userId: string, token: string, platform: PushPlatform, deviceName?: string) {
    return this.tokens.register(userId, token, platform, deviceName ?? null, this.clock.now());
  }
}

export class UnregisterPushToken {
  constructor(private readonly tokens: PushTokenRepository) {}

  execute(userId: string, token: string) {
    return this.tokens.unregister(userId, token);
  }
}

/** Sends one notification to every device of its recipients and keeps the tickets. */
export class DeliverPushNotification {
  constructor(
    private readonly tokens: PushTokenRepository,
    private readonly tickets: PushTicketRepository,
    private readonly sender: PushSender,
    private readonly clock: Clock,
  ) {}

  async execute(notification: PushNotification): Promise<{ sent: number }> {
    const devices = await this.tokens.tokensOf([...new Set(notification.recipients)]);
    if (devices.length === 0) return { sent: 0 };

    const messages: OutgoingPush[] = devices.map(({ token }) => ({
      token,
      title: notification.title,
      body: notification.body,
      data: { event: notification.event, url: notification.url },
    }));
    const results = await this.sender.send(messages);

    const pending = results.flatMap((result, i) =>
      result.ok ? [{ receiptId: result.receiptId, token: messages[i]!.token }] : [],
    );
    // Some errors are known at once: the app was uninstalled or the token is stale.
    const dead = results.flatMap((result, i) =>
      !result.ok && result.deviceNotRegistered ? [messages[i]!.token] : [],
    );
    if (pending.length > 0) await this.tickets.save(pending, this.clock.now());
    if (dead.length > 0) await this.tokens.remove(dead);
    return { sent: pending.length };
  }
}

/**
 * Reads the receipts of tickets sent a while ago and removes the tokens Expo
 * reports as `DeviceNotRegistered` (ADR-0017). Run periodically.
 */
export class CheckPushReceipts {
  constructor(
    private readonly tokens: PushTokenRepository,
    private readonly tickets: PushTicketRepository,
    private readonly sender: PushSender,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<{ checked: number; removedTokens: number }> {
    const due = await this.tickets.due(
      new Date(this.clock.now().getTime() - RECEIPT_DELAY_MS),
      RECEIPT_BATCH,
    );
    if (due.length === 0) return { checked: 0, removedTokens: 0 };

    const receipts = await this.sender.receipts(due.map((ticket) => ticket.receiptId));
    const dead = due.flatMap(({ receiptId, token }) => {
      const receipt = receipts.get(receiptId);
      return receipt && !receipt.ok && receipt.deviceNotRegistered ? [token] : [];
    });
    if (dead.length > 0) await this.tokens.remove([...new Set(dead)]);
    // Done with every receipt Expo answered; the rest are retried next time.
    const answered = due.filter(({ receiptId }) => receipts.has(receiptId));
    await this.tickets.delete(answered.map(({ receiptId }) => receiptId));
    return { checked: answered.length, removedTokens: new Set(dead).size };
  }
}

/**
 * PushNotifications for the other modules: waits for the database commit, then
 * delivers in the background (fire and forget, errors logged). A persistent queue
 * would replace this if delivery ever needs retries across restarts.
 */
export class AfterCommitPushNotifications extends PushNotifications {
  constructor(
    private readonly runner: TransactionRunner,
    private readonly deliver: DeliverPushNotification,
    private readonly onError: (error: unknown) => void,
  ) {
    super();
  }

  notify(notification: PushNotification): void {
    if (notification.recipients.length === 0) return;
    this.runner.afterCommit(() => {
      this.deliver.execute(notification).catch(this.onError);
    });
  }
}

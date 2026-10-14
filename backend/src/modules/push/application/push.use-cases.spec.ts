import type { Clock } from '../../../shared/application/clock.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import {
  type DeviceToken,
  type OutgoingPush,
  type PendingReceipt,
  type PushPlatform,
  PushSender,
  PushTicketRepository,
  PushTokenRepository,
  type ReceiptResult,
  type SendResult,
} from '../domain/push.js';
import {
  AfterCommitPushNotifications,
  CheckPushReceipts,
  DeliverPushNotification,
  RECEIPT_DELAY_MS,
} from './push.use-cases.js';

class InMemoryTokens extends PushTokenRepository {
  readonly devices = new Map<string, string>(); // token → user

  async register(userId: string, token: string, _platform: PushPlatform) {
    this.devices.set(token, userId);
  }
  async unregister(userId: string, token: string) {
    if (this.devices.get(token) === userId) this.devices.delete(token);
  }
  async tokensOf(userIds: readonly string[]): Promise<DeviceToken[]> {
    return [...this.devices]
      .filter(([, userId]) => userIds.includes(userId))
      .map(([token, userId]) => ({ token, userId }));
  }
  async remove(tokens: readonly string[]) {
    for (const token of tokens) this.devices.delete(token);
  }
}

class InMemoryTickets extends PushTicketRepository {
  readonly tickets: (PendingReceipt & { sentAt: Date })[] = [];

  async save(tickets: readonly PendingReceipt[], sentAt: Date) {
    this.tickets.push(...tickets.map((ticket) => ({ ...ticket, sentAt })));
  }
  async due(sentBefore: Date, limit: number) {
    return this.tickets.filter((ticket) => ticket.sentAt < sentBefore).slice(0, limit);
  }
  async delete(receiptIds: readonly string[]) {
    for (const id of receiptIds) {
      const index = this.tickets.findIndex((ticket) => ticket.receiptId === id);
      if (index >= 0) this.tickets.splice(index, 1);
    }
  }
}

class FakeSender extends PushSender {
  readonly sent: OutgoingPush[] = [];
  dead = new Set<string>();
  receiptResults = new Map<string, ReceiptResult>();

  async send(messages: readonly OutgoingPush[]): Promise<SendResult[]> {
    this.sent.push(...messages);
    return messages.map(({ token }) =>
      this.dead.has(token)
        ? { ok: false, deviceNotRegistered: true, message: 'gone' }
        : { ok: true, receiptId: `r-${token}` },
    );
  }
  async receipts(): Promise<Map<string, ReceiptResult>> {
    return this.receiptResults;
  }
}

const sentAt = new Date('2026-10-14T10:00:00Z');
const notification = {
  recipients: ['leo', 'eva', 'leo'],
  event: 'shared-expense' as const,
  title: 'Nuevo gasto compartido en Piso',
  body: '«Compra» · 12,34 €',
  url: '/household?filter=to-review',
};

function setup(now = sentAt) {
  const tokens = new InMemoryTokens();
  const tickets = new InMemoryTickets();
  const sender = new FakeSender();
  const clock: Clock = { now: () => now };
  return {
    tokens,
    tickets,
    sender,
    deliver: new DeliverPushNotification(tokens, tickets, sender, clock),
    check: (later: Date) =>
      new CheckPushReceipts(tokens, tickets, sender, { now: () => later }).execute(),
  };
}

describe('DeliverPushNotification', () => {
  it('sends once to every device of each recipient and keeps the tickets', async () => {
    const { tokens, tickets, sender, deliver } = setup();
    await tokens.register('leo', 'ExponentPushToken[leo-phone]', 'android');
    await tokens.register('leo', 'ExponentPushToken[leo-tablet]', 'ios');
    await tokens.register('eva', 'ExponentPushToken[eva]', 'ios');
    await tokens.register('ana', 'ExponentPushToken[ana]', 'ios');

    expect(await deliver.execute(notification)).toEqual({ sent: 3 });
    expect(sender.sent.map((message) => message.token).sort()).toEqual([
      'ExponentPushToken[eva]',
      'ExponentPushToken[leo-phone]',
      'ExponentPushToken[leo-tablet]',
    ]);
    expect(sender.sent[0]?.data).toEqual({
      event: 'shared-expense',
      url: '/household?filter=to-review',
    });
    expect(tickets.tickets).toHaveLength(3);
  });

  it('forgets devices reported as not registered in the ticket', async () => {
    const { tokens, tickets, sender, deliver } = setup();
    await tokens.register('leo', 'ExponentPushToken[old]', 'android');
    sender.dead.add('ExponentPushToken[old]');

    expect(await deliver.execute(notification)).toEqual({ sent: 0 });
    expect(tokens.devices.size).toBe(0);
    expect(tickets.tickets).toEqual([]);
  });

  it('does nothing when nobody has a device', async () => {
    const { sender, deliver } = setup();

    expect(await deliver.execute(notification)).toEqual({ sent: 0 });
    expect(sender.sent).toEqual([]);
  });
});

describe('CheckPushReceipts', () => {
  it('waits for receipts to be ready, removes dead tokens and retries unanswered ones', async () => {
    const { tokens, tickets, sender, deliver, check } = setup();
    await tokens.register('leo', 'ExponentPushToken[a]', 'android');
    await tokens.register('eva', 'ExponentPushToken[b]', 'ios');
    await deliver.execute(notification);

    // Too early: receipts are not ready yet.
    expect(await check(new Date(sentAt.getTime() + 60_000))).toEqual({
      checked: 0,
      removedTokens: 0,
    });

    sender.receiptResults.set('r-ExponentPushToken[a]', {
      ok: false,
      deviceNotRegistered: true,
      message: 'gone',
    });
    const later = new Date(sentAt.getTime() + RECEIPT_DELAY_MS + 1);
    expect(await check(later)).toEqual({ checked: 1, removedTokens: 1 });
    expect([...tokens.devices.keys()]).toEqual(['ExponentPushToken[b]']);
    // b had no receipt yet: it stays for the next run.
    expect(tickets.tickets.map((ticket) => ticket.receiptId)).toEqual(['r-ExponentPushToken[b]']);
  });
});

describe('AfterCommitPushNotifications', () => {
  it('delivers only after the commit, and never throws into the request', async () => {
    const effects: (() => void)[] = [];
    const runner = { afterCommit: (effect: () => void) => effects.push(effect) };
    const deliver = { execute: vi.fn(async () => Promise.reject(new Error('Expo is down'))) };
    const onError = vi.fn();
    const notifications = new AfterCommitPushNotifications(
      runner as unknown as TransactionRunner,
      deliver as unknown as DeliverPushNotification,
      onError,
    );

    notifications.notify(notification);
    notifications.notify({ ...notification, recipients: [] });
    expect(deliver.execute).not.toHaveBeenCalled();
    expect(effects).toHaveLength(1);

    effects[0]!();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
  });
});

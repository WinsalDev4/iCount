import {
  type OutgoingPush,
  PushSender,
  type ReceiptResult,
  type SendResult,
} from '../../src/modules/push/domain/push.js';

/** Records pushes instead of calling Expo; tokens in `dead` answer DeviceNotRegistered. */
export class InMemoryPushSender extends PushSender {
  readonly sent: OutgoingPush[] = [];
  readonly dead = new Set<string>();

  async send(messages: readonly OutgoingPush[]): Promise<SendResult[]> {
    this.sent.push(...messages);
    return messages.map(({ token }) =>
      this.dead.has(token)
        ? { ok: false, deviceNotRegistered: true, message: 'DeviceNotRegistered' }
        : { ok: true, receiptId: `receipt-${this.sent.length}-${token}` },
    );
  }

  async receipts(): Promise<Map<string, ReceiptResult>> {
    return new Map();
  }

  clear(): void {
    this.sent.length = 0;
    this.dead.clear();
  }
}

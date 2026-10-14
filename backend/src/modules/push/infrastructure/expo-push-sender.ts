import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

import {
  type OutgoingPush,
  type ReceiptResult,
  PushSender,
  type SendResult,
} from '../domain/push.js';

/**
 * Adapter over the official SDK (ADR-0017): batches of up to 100 messages and
 * 1000 receipt ids, with the SDK's own retries on 429/5xx. Android channel
 * `default` is the one the app creates before asking for permission.
 */
export class ExpoPushSender extends PushSender {
  constructor(private readonly expo: Expo) {
    super();
  }

  async send(messages: readonly OutgoingPush[]): Promise<SendResult[]> {
    const results: SendResult[] = [];
    const valid: { index: number; message: ExpoPushMessage }[] = [];
    messages.forEach((message, index) => {
      if (Expo.isExpoPushToken(message.token)) {
        valid.push({
          index,
          message: {
            to: message.token,
            title: message.title,
            body: message.body,
            data: { ...message.data },
            sound: 'default',
            channelId: 'default',
            priority: 'high',
          },
        });
      } else {
        // Not an Expo token at all: never worth sending again.
        results[index] = {
          ok: false,
          deviceNotRegistered: true,
          message: 'Not an Expo push token',
        };
      }
    });

    let offset = 0;
    for (const chunk of this.expo.chunkPushNotifications(valid.map(({ message }) => message))) {
      const tickets = await this.sendChunk(chunk);
      tickets.forEach((ticket, i) => {
        results[valid[offset + i]!.index] = toSendResult(ticket);
      });
      offset += chunk.length;
    }
    return results;
  }

  async receipts(receiptIds: readonly string[]): Promise<Map<string, ReceiptResult>> {
    const results = new Map<string, ReceiptResult>();
    for (const chunk of this.expo.chunkPushNotificationReceiptIds([...receiptIds])) {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
      for (const [id, receipt] of Object.entries(receipts)) {
        results.set(
          id,
          receipt.status === 'ok'
            ? { ok: true }
            : {
                ok: false,
                deviceNotRegistered: receipt.details?.error === 'DeviceNotRegistered',
                message: receipt.message,
              },
        );
      }
    }
    return results;
  }

  /** A whole chunk failing (network, 5xx after retries) marks its messages as failed, not dead. */
  private async sendChunk(chunk: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    try {
      return await this.expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return chunk.map(() => ({ status: 'error' as const, message }));
    }
  }
}

function toSendResult(ticket: ExpoPushTicket): SendResult {
  return ticket.status === 'ok'
    ? { ok: true, receiptId: ticket.id }
    : {
        ok: false,
        deviceNotRegistered: ticket.details?.error === 'DeviceNotRegistered',
        message: ticket.message,
      };
}

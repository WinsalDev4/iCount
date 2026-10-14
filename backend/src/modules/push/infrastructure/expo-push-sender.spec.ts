import type { Expo, ExpoPushMessage } from 'expo-server-sdk';

import { ExpoPushSender } from './expo-push-sender.js';

const token = (n: number) => `ExponentPushToken[device-${n}]`;
const push = (to: string) => ({
  token: to,
  title: 'Nuevo gasto compartido en Piso',
  body: '«Compra» · 12,34 €',
  data: { event: 'shared-expense' as const, url: '/household?filter=to-review' },
});

/** The SDK, simulated: chunks of 2 messages so batching is visible. */
function fakeExpo(overrides: Partial<Record<keyof Expo, unknown>> = {}) {
  const sent: ExpoPushMessage[][] = [];
  const expo = {
    chunkPushNotifications: (messages: ExpoPushMessage[]) => {
      const chunks: ExpoPushMessage[][] = [];
      for (let i = 0; i < messages.length; i += 2) chunks.push(messages.slice(i, i + 2));
      return chunks;
    },
    sendPushNotificationsAsync: vi.fn(async (chunk: ExpoPushMessage[]) => {
      sent.push(chunk);
      return chunk.map((message) =>
        message.to === token(3)
          ? {
              status: 'error',
              message: 'not registered',
              details: { error: 'DeviceNotRegistered' },
            }
          : { status: 'ok', id: `receipt-${String(message.to)}` },
      );
    }),
    chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
    getPushNotificationReceiptsAsync: vi.fn(async () => ({
      'receipt-a': { status: 'ok' },
      'receipt-b': {
        status: 'error',
        message: 'gone',
        details: { error: 'DeviceNotRegistered' },
      },
      'receipt-c': { status: 'error', message: 'rate', details: { error: 'MessageRateExceeded' } },
    })),
    ...overrides,
  };
  return { expo: expo as unknown as Expo, sent };
}

describe('ExpoPushSender', () => {
  it('sends in batches and keeps results in the order of the messages', async () => {
    const { expo, sent } = fakeExpo();
    const sender = new ExpoPushSender(expo);

    const results = await sender.send([1, 2, 3, 4, 5].map((n) => push(token(n))));

    expect(sent.map((chunk) => chunk.length)).toEqual([2, 2, 1]);
    expect(sent[0]?.[0]).toMatchObject({
      to: token(1),
      channelId: 'default',
      data: { event: 'shared-expense', url: '/household?filter=to-review' },
    });
    expect(results.map((r) => (r.ok ? r.receiptId : r.deviceNotRegistered))).toEqual([
      `receipt-${token(1)}`,
      `receipt-${token(2)}`,
      true,
      `receipt-${token(4)}`,
      `receipt-${token(5)}`,
    ]);
  });

  it('never sends what is not an Expo token, and reports it as dead', async () => {
    const { expo, sent } = fakeExpo();

    const results = await new ExpoPushSender(expo).send([push('not-a-token'), push(token(1))]);

    expect(sent.flat().map((message) => message.to)).toEqual([token(1)]);
    expect(results[0]).toMatchObject({ ok: false, deviceNotRegistered: true });
    expect(results[1]).toMatchObject({ ok: true });
  });

  it('a chunk that fails as a whole is an error, not a dead device', async () => {
    const { expo } = fakeExpo({
      sendPushNotificationsAsync: vi.fn(async () => {
        throw new Error('503 Service Unavailable');
      }),
    });

    const [result] = await new ExpoPushSender(expo).send([push(token(1))]);

    expect(result).toEqual({
      ok: false,
      deviceNotRegistered: false,
      message: '503 Service Unavailable',
    });
  });

  it('maps receipts, flagging DeviceNotRegistered', async () => {
    const { expo } = fakeExpo();

    const receipts = await new ExpoPushSender(expo).receipts([
      'receipt-a',
      'receipt-b',
      'receipt-c',
    ]);

    expect(receipts.get('receipt-a')).toEqual({ ok: true });
    expect(receipts.get('receipt-b')).toMatchObject({ ok: false, deviceNotRegistered: true });
    expect(receipts.get('receipt-c')).toMatchObject({ ok: false, deviceNotRegistered: false });
  });
});

import { describe, expect, it } from 'vitest';

import {
  activityItemDtoSchema,
  activityQuerySchema,
  approvalDecisionRequestSchema,
  createSettlementRequestSchema,
  householdBalanceDtoSchema,
  pushDataSchema,
  registerPushTokenRequestSchema,
} from '../index.ts';

const ana = '0199e0a4-5b2c-7c3d-9e4f-0000000000a1';
const leo = '0199e0a4-5b2c-7c3d-9e4f-0000000000b2';
const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });

describe('balances and settlements', () => {
  it('parse a balance with a suggested transfer', () => {
    const balance = {
      householdId: '0199e0a4-5b2c-7c3d-9e4f-0000000000c3',
      members: [
        { memberId: ana, paid: eur(100_000), owed: eur(60_000), net: eur(40_000) },
        { memberId: leo, paid: eur(20_000), owed: eur(60_000), net: eur(-40_000) },
      ],
      suggestedTransfers: [{ fromMemberId: leo, toMemberId: ana, amount: eur(40_000) }],
      pendingApprovalCount: 1,
    };
    expect(householdBalanceDtoSchema.parse(balance)).toEqual(balance);
  });

  it('reject transfers to oneself and zero amounts', () => {
    const base = { fromMemberId: leo, toMemberId: ana, amount: eur(40_000), method: 'bizum' };
    expect(createSettlementRequestSchema.parse({ ...base, settledOn: '2026-10-14' }).note).toBe('');
    expect(
      createSettlementRequestSchema.safeParse({ ...base, toMemberId: leo, settledOn: '2026-10-14' })
        .success,
    ).toBe(false);
    expect(
      createSettlementRequestSchema.safeParse({ ...base, amount: eur(0), settledOn: '2026-10-14' })
        .success,
    ).toBe(false);
  });
});

describe('activity', () => {
  it('reads unknown event types as unknown', () => {
    const item = {
      id: '0199e0a4-5b2c-7c3d-9e4f-0000000000a9',
      householdId: '0199e0a4-5b2c-7c3d-9e4f-0000000000c3',
      type: 'budget-exceeded',
      actorId: ana,
      occurredAt: '2026-10-14T09:00:00.000Z',
      transactionId: null,
      settlementId: null,
      amount: null,
      description: null,
      approval: null,
      commentCount: 0,
    };
    expect(activityItemDtoSchema.parse(item).type).toBe('unknown');
  });

  it('defaults the filter and requires a reason to reject', () => {
    expect(activityQuerySchema.parse({})).toEqual({ limit: 20, filter: 'all' });
    expect(approvalDecisionRequestSchema.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(approvalDecisionRequestSchema.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(
      approvalDecisionRequestSchema.safeParse({ decision: 'reject', reason: 'Es personal' })
        .success,
    ).toBe(true);
  });
});

describe('push', () => {
  it('accepts Expo push tokens only', () => {
    const request = { token: 'ExponentPushToken[abc123]', platform: 'android' };
    expect(registerPushTokenRequestSchema.parse(request)).toEqual(request);
    expect(
      registerPushTokenRequestSchema.safeParse({ ...request, token: 'fcm-raw-token' }).success,
    ).toBe(false);
  });

  it('carries an in-app path to open on tap', () => {
    expect(pushDataSchema.parse({ event: 'approval-pending', url: '/household' }).url).toBe(
      '/household',
    );
    expect(pushDataSchema.safeParse({ event: 'x', url: 'https://evil.example' }).success).toBe(
      false,
    );
  });
});

import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import {
  type DeviceToken,
  type PendingReceipt,
  type PushPlatform,
  PushTicketRepository,
  PushTokenRepository,
} from '../../domain/push.js';
import { pushTicketsTable, pushTokensTable } from './push.schema.js';

const tk = pushTokensTable;
const tc = pushTicketsTable;

@Injectable()
export class DrizzlePushTokenRepository extends PushTokenRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async register(
    userId: string,
    token: string,
    platform: PushPlatform,
    deviceName: string | null,
    now: Date,
  ): Promise<void> {
    await this.context.db
      .insert(tk)
      .values({ token, userId, platform, deviceName, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: tk.token,
        set: { userId, platform, deviceName, updatedAt: now },
      });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.context.db.delete(tk).where(and(eq(tk.token, token), eq(tk.userId, userId)));
  }

  async tokensOf(userIds: readonly string[]): Promise<DeviceToken[]> {
    if (userIds.length === 0) return [];
    return this.context.db
      .select({ userId: tk.userId, token: tk.token })
      .from(tk)
      .where(inArray(tk.userId, [...userIds]));
  }

  async remove(tokens: readonly string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.context.db.delete(tk).where(inArray(tk.token, [...tokens]));
  }
}

@Injectable()
export class DrizzlePushTicketRepository extends PushTicketRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async save(tickets: readonly PendingReceipt[], sentAt: Date): Promise<void> {
    if (tickets.length === 0) return;
    await this.context.db
      .insert(tc)
      .values(tickets.map((ticket) => ({ ...ticket, sentAt })))
      .onConflictDoNothing();
  }

  due(sentBefore: Date, limit: number): Promise<PendingReceipt[]> {
    return this.context.db
      .select({ receiptId: tc.receiptId, token: tc.token })
      .from(tc)
      .where(lt(tc.sentAt, sentBefore))
      .orderBy(asc(tc.sentAt))
      .limit(limit);
  }

  async delete(receiptIds: readonly string[]): Promise<void> {
    if (receiptIds.length === 0) return;
    await this.context.db.delete(tc).where(inArray(tc.receiptId, [...receiptIds]));
  }
}

import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, lt } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import { householdMembersTable } from '../../../households/infrastructure/persistence/households.schema.js';
import {
  type AdvisorConsent,
  AdvisorRepository,
  type ChatMessage,
  type Conversation,
  type InsightsReport,
} from '../../domain/advisor.js';
import type { AdvisorAction } from '../../domain/findings.js';
import {
  advisorAppliedActionsTable,
  advisorConsentsTable,
  advisorConversationsTable,
  advisorMessagesTable,
  advisorReportsTable,
} from './advisor.schema.js';

const consents = advisorConsentsTable;
const reports = advisorReportsTable;
const conversations = advisorConversationsTable;
const messages = advisorMessagesTable;

@Injectable()
export class DrizzleAdvisorRepository extends AdvisorRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async consentOf(userId: string): Promise<AdvisorConsent | null> {
    const [row] = await this.context.db
      .select()
      .from(consents)
      .where(eq(consents.userId, userId))
      .limit(1);
    return row ? { granted: row.granted, version: row.version, grantedAt: row.grantedAt } : null;
  }

  async householdsWithConsent(version: number): Promise<string[]> {
    const rows = await this.context.db
      .selectDistinct({ id: householdMembersTable.householdId })
      .from(householdMembersTable)
      .innerJoin(consents, eq(consents.userId, householdMembersTable.userId))
      .where(and(eq(consents.granted, true), eq(consents.version, version)));
    return rows.map((row) => row.id);
  }

  async saveConsent(userId: string, consent: AdvisorConsent): Promise<void> {
    await this.context.db
      .insert(consents)
      .values({ userId, ...consent })
      .onConflictDoUpdate({ target: consents.userId, set: { ...consent } });
  }

  async cachedReport(householdId: string) {
    const [row] = await this.context.db
      .select()
      .from(reports)
      .where(eq(reports.householdId, householdId))
      .limit(1);
    return row
      ? { fingerprint: row.fingerprint, report: { ...row.report, generatedAt: row.generatedAt } }
      : null;
  }

  async saveReport(householdId: string, fingerprint: string, report: InsightsReport) {
    const { generatedAt, ...serialized } = report;
    await this.context.db
      .insert(reports)
      .values({ householdId, fingerprint, report: serialized, generatedAt })
      .onConflictDoUpdate({
        target: reports.householdId,
        set: { fingerprint, report: serialized, generatedAt },
      });
  }

  async findConversation(id: string): Promise<Conversation | null> {
    const [row] = await this.context.db
      .select({
        id: conversations.id,
        householdId: conversations.householdId,
        userId: conversations.userId,
      })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return row ?? null;
  }

  async createConversation(conversation: Conversation, now: Date): Promise<void> {
    await this.context.db
      .insert(conversations)
      .values({ ...conversation, createdAt: now, lastMessageAt: now });
  }

  async appendMessage(message: ChatMessage): Promise<void> {
    await this.context.run(async () => {
      await this.context.db.insert(messages).values(message);
      await this.context.db
        .update(conversations)
        .set({ lastMessageAt: message.createdAt })
        .where(eq(conversations.id, message.conversationId));
    });
  }

  async recentMessages(conversationId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.context.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit);
    return rows.reverse().map((row) => ({ ...row, plan: row.plan ?? null }));
  }

  async countUserMessagesSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.context.db
      .select({ total: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.userId, userId),
          eq(messages.role, 'user'),
          gte(messages.createdAt, since),
        ),
      );
    return row?.total ?? 0;
  }

  async deleteConversationsOf(userId: string): Promise<void> {
    await this.context.db.delete(conversations).where(eq(conversations.userId, userId));
  }

  async purgeConversationsBefore(before: Date): Promise<number> {
    const old = await this.context.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(lt(conversations.lastMessageAt, before))
      .orderBy(asc(conversations.lastMessageAt));
    if (old.length === 0) return 0;
    await this.context.db.delete(conversations).where(
      inArray(
        conversations.id,
        old.map((row) => row.id),
      ),
    );
    return old.length;
  }

  async recordApplied(entry: {
    id: string;
    householdId: string;
    userId: string;
    insightId: string | null;
    planId: string | null;
    action: AdvisorAction;
    createdAt: Date;
  }): Promise<void> {
    await this.context.db.insert(advisorAppliedActionsTable).values(entry);
  }
}

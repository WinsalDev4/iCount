import { Injectable } from '@nestjs/common';
import type { CurrencyCode } from '@icount/contracts';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import { usersTable } from '../../../auth/infrastructure/persistence/auth.schema.js';
import { Household, HouseholdRepository, type Member } from '../../domain/household.js';
import { type Invitation, InvitationRepository } from '../../domain/invitation.js';
import {
  householdInvitationsTable,
  householdMembersTable,
  householdsTable,
} from './households.schema.js';

/** Repositories use `context.db`, so they join the current unit of work when there is one. */
@Injectable()
export class DrizzleHouseholdRepository extends HouseholdRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async findById(id: string): Promise<Household | null> {
    const [found] = await this.load([id]);
    return found ?? null;
  }

  async findForMember(userId: string): Promise<Household[]> {
    const rows = await this.context.db
      .select({ id: householdMembersTable.householdId })
      .from(householdMembersTable)
      .where(eq(householdMembersTable.userId, userId));
    return this.load(rows.map((row) => row.id));
  }

  save(household: Household): Promise<void> {
    return this.context.run(async () => {
      const db = this.context.db;
      const values = {
        id: household.id,
        name: household.name,
        kind: household.kind,
        currency: household.currency,
        splitRule: household.splitRule,
        createdAt: household.createdAt,
      };
      await db
        .insert(householdsTable)
        .values(values)
        .onConflictDoUpdate({
          target: householdsTable.id,
          set: { name: values.name, splitRule: values.splitRule },
        });

      for (const member of household.members) {
        await db
          .insert(householdMembersTable)
          .values({
            householdId: household.id,
            userId: member.userId,
            role: member.role,
            monthlyIncomeMinor: member.monthlyIncomeMinor,
            joinedAt: member.joinedAt,
          })
          .onConflictDoUpdate({
            target: [householdMembersTable.householdId, householdMembersTable.userId],
            set: { role: member.role, monthlyIncomeMinor: member.monthlyIncomeMinor },
          });
      }
    });
  }

  /** Two queries (households + members with their user) instead of N+1. */
  private async load(ids: string[]): Promise<Household[]> {
    if (ids.length === 0) return [];
    const db = this.context.db;
    const households = await db
      .select()
      .from(householdsTable)
      .where(inArray(householdsTable.id, ids))
      .orderBy(asc(householdsTable.createdAt));
    const members = await db
      .select({
        householdId: householdMembersTable.householdId,
        userId: householdMembersTable.userId,
        role: householdMembersTable.role,
        monthlyIncomeMinor: householdMembersTable.monthlyIncomeMinor,
        joinedAt: householdMembersTable.joinedAt,
        email: usersTable.email,
        displayName: usersTable.displayName,
      })
      .from(householdMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, householdMembersTable.userId))
      .where(inArray(householdMembersTable.householdId, ids))
      .orderBy(asc(householdMembersTable.joinedAt));

    return households.map((row) =>
      Household.restore({
        id: row.id,
        name: row.name,
        kind: row.kind,
        currency: row.currency as CurrencyCode,
        splitRule: row.splitRule,
        createdAt: row.createdAt,
        members: members
          .filter((member) => member.householdId === row.id)
          .map((member): Member => ({
            userId: member.userId,
            email: member.email,
            displayName: member.displayName,
            role: member.role,
            monthlyIncomeMinor: member.monthlyIncomeMinor,
            joinedAt: member.joinedAt,
          })),
      }),
    );
  }
}

@Injectable()
export class DrizzleInvitationRepository extends InvitationRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async create(invitation: Invitation): Promise<boolean> {
    const inserted = await this.context.db
      .insert(householdInvitationsTable)
      .values({ ...invitation, usedBy: null })
      .onConflictDoNothing({ target: householdInvitationsTable.code })
      .returning({ id: householdInvitationsTable.id });
    return inserted.length === 1;
  }

  async findByCode(code: string): Promise<Invitation | null> {
    const [row] = await this.context.db
      .select()
      .from(householdInvitationsTable)
      .where(eq(householdInvitationsTable.code, code))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      householdId: row.householdId,
      code: row.code,
      createdBy: row.createdBy,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
    };
  }

  async markUsed(id: string, userId: string, now: Date): Promise<boolean> {
    const updated = await this.context.db
      .update(householdInvitationsTable)
      .set({ usedAt: now, usedBy: userId })
      .where(and(eq(householdInvitationsTable.id, id), isNull(householdInvitationsTable.usedAt)))
      .returning({ id: householdInvitationsTable.id });
    return updated.length === 1;
  }
}

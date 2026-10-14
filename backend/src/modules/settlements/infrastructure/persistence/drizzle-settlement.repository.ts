import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, isNull, lte, or, type SQL, sql } from 'drizzle-orm';

import { DatabaseContext } from '../../../../shared/database/database-context.js';
import { householdsTable } from '../../../households/infrastructure/persistence/households.schema.js';
import {
  transactionSharesTable,
  transactionsTable,
} from '../../../transactions/infrastructure/persistence/transactions.schema.js';
import {
  type BalancePeriod,
  type MemberTotals,
  Settlement,
  SettlementRepository,
} from '../../domain/settlement.js';
import { settlementsTable } from './settlements.schema.js';

const t = transactionsTable;
const s = transactionSharesTable;
const st = settlementsTable;

/** Shared income (a common refund) counts with the opposite sign (ADR-0016). */
function signedSum(amount: SQL | typeof s.amountMinor | typeof t.amountMinor) {
  return sql<number>`coalesce(sum(case when ${t.type} = 'expense' then ${amount} else -${amount} end), 0)`.mapWith(
    Number,
  );
}

@Injectable()
export class DrizzleSettlementRepository extends SettlementRepository {
  constructor(private readonly context: DatabaseContext) {
    super();
  }

  async save(settlement: Settlement): Promise<void> {
    await this.context.db.insert(st).values(settlement.snapshot);
  }

  async listForHousehold(householdId: string): Promise<Settlement[]> {
    const rows = await this.context.db
      .select()
      .from(st)
      .where(eq(st.householdId, householdId))
      .orderBy(desc(st.settledOn), desc(st.createdAt), desc(st.id));
    return rows.map((row) => Settlement.restore(row));
  }

  async sharedHouseholdIds(): Promise<string[]> {
    const rows = await this.context.db
      .select({ id: householdsTable.id })
      .from(householdsTable)
      .where(eq(householdsTable.kind, 'shared'));
    return rows.map((row) => row.id);
  }

  /** Five aggregate queries; the arithmetic (nets, transfers) stays in the use case. */
  async memberTotals(householdId: string, period: BalancePeriod): Promise<MemberTotals> {
    const db = this.context.db;
    const sharedInPeriod = [
      eq(t.householdId, householdId),
      eq(t.shared, true),
      period.from ? gte(t.occurredOn, period.from) : undefined,
      period.to ? lte(t.occurredOn, period.to) : undefined,
    ];
    // Only approved movements (or those that never needed approval) count.
    const counted = and(
      ...sharedInPeriod,
      or(isNull(t.approvalStatus), eq(t.approvalStatus, 'approved')),
    );
    const settledInPeriod = and(
      eq(st.householdId, householdId),
      period.from ? gte(st.settledOn, period.from) : undefined,
      period.to ? lte(st.settledOn, period.to) : undefined,
    );
    const settlementSum = sql<number>`coalesce(sum(${st.amountMinor}), 0)`.mapWith(Number);

    const [paidRows, owedRows, sentRows, receivedRows, [pending]] = await Promise.all([
      db
        .select({ memberId: t.payerId, total: signedSum(t.amountMinor) })
        .from(t)
        .where(counted)
        .groupBy(t.payerId),
      db
        .select({ memberId: s.memberId, total: signedSum(s.amountMinor) })
        .from(s)
        .innerJoin(t, eq(s.transactionId, t.id))
        .where(counted)
        .groupBy(s.memberId),
      db
        .select({ memberId: st.fromMemberId, total: settlementSum })
        .from(st)
        .where(settledInPeriod)
        .groupBy(st.fromMemberId),
      db
        .select({ memberId: st.toMemberId, total: settlementSum })
        .from(st)
        .where(settledInPeriod)
        .groupBy(st.toMemberId),
      db
        .select({ total: count() })
        .from(t)
        .where(and(...sharedInPeriod, eq(t.approvalStatus, 'pending'))),
    ]);

    return {
      paid: addUp(paidRows, sentRows),
      owed: addUp(owedRows, receivedRows),
      pendingApprovalCount: pending?.total ?? 0,
    };
  }
}

function addUp(...groups: { memberId: string; total: number }[][]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { memberId, total } of groups.flat()) {
    totals.set(memberId, (totals.get(memberId) ?? 0) + total);
  }
  return totals;
}

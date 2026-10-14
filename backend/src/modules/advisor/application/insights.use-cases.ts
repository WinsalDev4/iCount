import { createHash } from 'node:crypto';

import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { Today } from '../../../shared/application/today.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import type { Household } from '../../households/domain/household.js';
import {
  ADVISOR_CONSENT_VERSION,
  type AdvisorModel,
  type AdvisorRepository,
  type Insight,
  type InsightsReport,
  type RankedInsight,
} from '../domain/advisor.js';
import { allowedFigures, inventedFigures } from '../domain/figures.js';
import { detectAll, type Finding } from '../domain/findings.js';
import type { ReadHouseholdSnapshot } from './read-snapshot.js';

const MAX_TITLE = 80;
const MAX_BODY = 400;

/** Same findings (same figures) → same fingerprint → the cached report is still valid. */
export function fingerprintOf(findings: readonly Finding[], day: string): string {
  const relevant = findings.map(({ key, evidence, potentialMonthlySavingsMinor, actions }) => ({
    key,
    evidence,
    potentialMonthlySavingsMinor,
    actions,
  }));
  return createHash('sha256').update(JSON.stringify({ day, relevant })).digest('hex');
}

/**
 * Applies the model's ranking only where it is safe: known key, sensible
 * lengths and **no figure that is not in the data**. Anything else keeps the
 * detector's default text and order (ADR-0020).
 */
export function composeInsights(
  findings: readonly Finding[],
  ranked: readonly RankedInsight[] | null,
  currency: string,
  newId: () => string,
): Insight[] {
  const allowed = allowedFigures(findings, currency);
  const byKey = new Map<string, RankedInsight>();
  for (const entry of ranked ?? []) {
    const safe =
      entry.title.trim().length > 0 &&
      entry.title.length <= MAX_TITLE &&
      entry.body.trim().length > 0 &&
      entry.body.length <= MAX_BODY &&
      inventedFigures(`${entry.title} ${entry.body}`, allowed).length === 0;
    if (safe && !byKey.has(entry.key)) byKey.set(entry.key, entry);
  }

  return findings
    .map((finding, index) => {
      const model = byKey.get(finding.key);
      return {
        finding,
        // Detectors are already sorted by weight: that is the default priority.
        priority: Math.min(5, Math.max(1, Math.round(model?.priority ?? index + 1))),
        title: model?.title.trim() ?? finding.defaultTitle,
        body: model?.body.trim() ?? finding.defaultBody,
        index,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ finding, priority, title, body }) => ({
      id: newId(),
      kind: finding.kind,
      priority,
      title: title.slice(0, MAX_TITLE),
      body: body.slice(0, MAX_BODY),
      potentialMonthlySavingsMinor: finding.potentialMonthlySavingsMinor,
      evidence: finding.evidence.slice(0, 5),
      actions: finding.actions.slice(0, 3),
    }));
}

/** Builds (or reuses) the report of one household. Shared by the endpoint and the daily job. */
export class BuildInsightsReport {
  constructor(
    private readonly snapshots: ReadHouseholdSnapshot,
    private readonly advisor: AdvisorRepository,
    private readonly model: AdvisorModel,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly today: Today,
  ) {}

  /** `useModel`: someone in the household consented to send aggregates to the model. */
  async execute(household: Household, useModel: boolean): Promise<InsightsReport> {
    const today = this.today();
    const snapshot = await this.snapshots.execute(household, today);
    const findings = detectAll(snapshot);
    const fingerprint = fingerprintOf(findings, today) + (useModel ? ':model' : ':plain');

    const cached = await this.advisor.cachedReport(household.id);
    if (cached?.fingerprint === fingerprint) return cached.report;

    const ranked =
      useModel && this.model.available && findings.length > 0
        ? await this.model.rankInsights(findings, household.currency)
        : null;
    const report: InsightsReport = {
      generatedAt: this.clock.now(),
      currency: household.currency,
      insights: composeInsights(findings, ranked, household.currency, () => this.ids.next()),
    };
    await this.advisor.saveReport(household.id, fingerprint, report);
    return report;
  }
}

export class GetInsights {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly advisor: AdvisorRepository,
    private readonly build: BuildInsightsReport,
  ) {}

  async execute(actorId: string, householdId: string): Promise<InsightsReport> {
    const household = await this.access.requireMember(householdId, actorId);
    const consent = await this.advisor.consentOf(actorId);
    // Without consent nothing goes to the model: the deterministic findings still help.
    const consented = consent?.granted === true && consent.version === ADVISOR_CONSENT_VERSION;
    return this.build.execute(household, consented);
  }
}

import type { z } from 'zod';

import { DomainError } from '../../../shared/domain/domain-error.js';
import type { AdvisorAction, Evidence, Finding, InsightKind } from './findings.js';

/** Version of the consent text; bump it to ask everybody again. */
export const ADVISOR_CONSENT_VERSION = 1;
/** Conversations are kept this long (ADR-0020). */
export const CONVERSATION_RETENTION_DAYS = 30;

export interface Insight {
  readonly id: string;
  readonly kind: InsightKind;
  /** 1 = most important. */
  readonly priority: number;
  readonly title: string;
  readonly body: string;
  readonly potentialMonthlySavingsMinor: number | null;
  readonly evidence: readonly Evidence[];
  readonly actions: readonly AdvisorAction[];
}

export interface InsightsReport {
  readonly generatedAt: Date;
  readonly currency: string;
  readonly insights: readonly Insight[];
}

/** A savings or debt plan; its projection always comes from @icount/finance. */
export interface Plan {
  readonly id: string;
  readonly kind: 'savings' | 'debt-payoff';
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly {
    readonly title: string;
    readonly detail: string;
    readonly action: AdvisorAction | null;
  }[];
  readonly projection: {
    readonly monthlySavingMinor: number | null;
    readonly interestSavedMinor: number | null;
    readonly debtFreeDate: string | null;
  };
  readonly currency: string;
}

export interface AdvisorConsent {
  readonly granted: boolean;
  readonly version: number;
  readonly grantedAt: Date | null;
}

export interface ChatMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly plan: Plan | null;
  readonly createdAt: Date;
}

export interface Conversation {
  readonly id: string;
  readonly householdId: string;
  readonly userId: string;
}

export abstract class AdvisorRepository {
  abstract consentOf(userId: string): Promise<AdvisorConsent | null>;
  /** Households with at least one member who accepted the current consent (daily job). */
  abstract householdsWithConsent(version: number): Promise<string[]>;
  abstract saveConsent(userId: string, consent: AdvisorConsent): Promise<void>;

  /** Cached report and the fingerprint of the findings it was built from. */
  abstract cachedReport(
    householdId: string,
  ): Promise<{ fingerprint: string; report: InsightsReport } | null>;
  abstract saveReport(
    householdId: string,
    fingerprint: string,
    report: InsightsReport,
  ): Promise<void>;

  abstract findConversation(id: string): Promise<Conversation | null>;
  abstract createConversation(conversation: Conversation, now: Date): Promise<void>;
  abstract appendMessage(message: ChatMessage): Promise<void>;
  /** The last `limit` messages, oldest first. */
  abstract recentMessages(conversationId: string, limit: number): Promise<ChatMessage[]>;
  abstract countUserMessagesSince(userId: string, since: Date): Promise<number>;
  abstract deleteConversationsOf(userId: string): Promise<void>;
  /** Retention: removes conversations whose last message is older than `before`. */
  abstract purgeConversationsBefore(before: Date): Promise<number>;

  abstract recordApplied(entry: {
    id: string;
    householdId: string;
    userId: string;
    insightId: string | null;
    planId: string | null;
    action: AdvisorAction;
    createdAt: Date;
  }): Promise<void>;
}

/** The model's opinion about one finding: order and wording only. */
export interface RankedInsight {
  readonly key: string;
  readonly priority: number;
  readonly title: string;
  readonly body: string;
}

/** A tool the chat model can call; its input is validated before it runs. */
export interface AdvisorTool<Input = unknown> {
  readonly name: string;
  readonly description: string;
  /** JSON Schema (strict: every property required, no extra ones). */
  readonly inputSchema: Record<string, unknown>;
  readonly input: z.ZodType<Input>;
  run(input: Input): Promise<{ readonly content: unknown; readonly plan?: Plan }>;
}

export interface ChatTurnRequest {
  /** Aggregates of the household as text (volatile, after the cached prefix). */
  readonly context: string;
  /** Earlier messages of the conversation, oldest first. */
  readonly history: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
  readonly message: string;
  readonly tools: readonly AdvisorTool[];
}

export interface ChatSink {
  text(delta: string): void;
  plan(plan: Plan): void;
}

/**
 * Port to the language model (ADR-0020): Claude through @anthropic-ai/sdk in
 * production, fakes in tests. It never computes figures: findings and tool
 * results already carry them.
 */
export abstract class AdvisorModel {
  /** False when there is no API key: the advisor degrades to default texts. */
  abstract readonly available: boolean;
  /** Null on any failure (refusal, invalid output, API error): use the defaults. */
  abstract rankInsights(
    findings: readonly Finding[],
    currency: string,
  ): Promise<RankedInsight[] | null>;
  /** Streams one answer through `sink`, running tools as the model asks. */
  abstract chat(
    request: ChatTurnRequest,
    sink: ChatSink,
    signal: AbortSignal,
  ): Promise<{ readonly text: string; readonly refused: boolean }>;
}

export class AdvisorConsentRequiredError extends DomainError {
  readonly kind = 'forbidden';
  readonly code = 'advisor-consent-required';
  readonly title = 'The advisor needs your consent';

  constructor() {
    super('Accept the advisor terms before sending your data to the assistant.');
  }
}

export class AdvisorQuotaExceededError extends DomainError {
  readonly kind = 'rate_limited';
  readonly code = 'advisor-quota-exceeded';
  readonly title = 'Daily advisor limit reached';

  constructor(quota: number) {
    super(`You can send ${quota} messages a day to the advisor. Try again tomorrow.`);
  }
}

export class AdvisorUnavailableError extends DomainError {
  readonly kind = 'unavailable';
  readonly code = 'advisor-unavailable';
  readonly title = 'The advisor is not available';

  constructor(detail = 'The assistant is not configured on this server.') {
    super(detail);
  }
}

export class ConversationNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'conversation-not-found';
  readonly title = 'Conversation not found';

  constructor(id: string) {
    super(`Conversation ${id} does not exist or you cannot see it.`);
  }
}

export class InvalidConsentVersionError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-consent-version';
  readonly title = 'Outdated consent';

  constructor() {
    super(`Accept the current version (${ADVISOR_CONSENT_VERSION}) of the advisor terms.`);
  }
}

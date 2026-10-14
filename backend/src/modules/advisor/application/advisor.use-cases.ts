import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import type { Today } from '../../../shared/application/today.js';
import type { TransactionRunner } from '../../../shared/application/transaction-runner.js';
import type { HouseholdAccess } from '../../households/application/household-access.js';
import {
  ADVISOR_CONSENT_VERSION,
  type AdvisorConsent,
  AdvisorConsentRequiredError,
  type AdvisorModel,
  AdvisorQuotaExceededError,
  type AdvisorRepository,
  AdvisorUnavailableError,
  type ChatSink,
  ConversationNotFoundError,
  InvalidConsentVersionError,
  type Plan,
} from '../domain/advisor.js';
import type { AdvisorAction } from '../domain/findings.js';
import { chatTools, describeHousehold } from './chat-tools.js';
import type { ReadHouseholdSnapshot } from './read-snapshot.js';

/** Messages of the conversation sent back to the model (older ones are dropped). */
const HISTORY_LIMIT = 20;

async function requireConsent(advisor: AdvisorRepository, userId: string): Promise<void> {
  const consent = await advisor.consentOf(userId);
  if (consent?.granted !== true || consent.version !== ADVISOR_CONSENT_VERSION) {
    throw new AdvisorConsentRequiredError();
  }
}

export class GetAdvisorConsent {
  constructor(private readonly advisor: AdvisorRepository) {}

  async execute(userId: string): Promise<AdvisorConsent> {
    return (
      (await this.advisor.consentOf(userId)) ?? {
        granted: false,
        version: ADVISOR_CONSENT_VERSION,
        grantedAt: null,
      }
    );
  }
}

/** Granting needs the current version; revoking also deletes the user's conversations. */
export class SetAdvisorConsent {
  constructor(
    private readonly advisor: AdvisorRepository,
    private readonly runner: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  execute(userId: string, granted: boolean, version: number): Promise<AdvisorConsent> {
    return this.runner.run(async () => {
      if (granted && version !== ADVISOR_CONSENT_VERSION) throw new InvalidConsentVersionError();
      const consent: AdvisorConsent = {
        granted,
        version: ADVISOR_CONSENT_VERSION,
        grantedAt: granted ? this.clock.now() : null,
      };
      await this.advisor.saveConsent(userId, consent);
      if (!granted) await this.advisor.deleteConversationsOf(userId);
      return consent;
    });
  }
}

export class RecordAppliedAction {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly advisor: AdvisorRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    actorId: string,
    householdId: string,
    action: AdvisorAction,
    source: { insightId?: string; planId?: string },
  ): Promise<void> {
    await this.access.requireMember(householdId, actorId);
    await this.advisor.recordApplied({
      id: this.ids.next(),
      householdId,
      userId: actorId,
      insightId: source.insightId ?? null,
      planId: source.planId ?? null,
      action,
      createdAt: this.clock.now(),
    });
  }
}

export interface ChatSession {
  /** Runs the model; events go to `sink`. Resolves with what the `done` event needs. */
  stream(
    sink: ChatSink,
    signal: AbortSignal,
  ): Promise<{ conversationId: string; messageId: string; remainingMessagesToday: number }>;
}

/**
 * Chat with the advisor (ADR-0020). `start` does every check that can fail with
 * a normal HTTP error (consent, configuration, quota, conversation ownership)
 * before the SSE stream opens.
 */
export class StartAdvisorChat {
  constructor(
    private readonly access: HouseholdAccess,
    private readonly advisor: AdvisorRepository,
    private readonly model: AdvisorModel,
    private readonly snapshots: ReadHouseholdSnapshot,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly today: Today,
    private readonly dailyQuota: number,
    /** Start of "today" in the households' time zone, as an instant. */
    private readonly startOfToday: () => Date,
  ) {}

  async start(
    actorId: string,
    householdId: string,
    message: string,
    conversationId?: string,
  ): Promise<ChatSession> {
    const household = await this.access.requireMember(householdId, actorId);
    await requireConsent(this.advisor, actorId);
    if (!this.model.available) throw new AdvisorUnavailableError();

    const used = await this.advisor.countUserMessagesSince(actorId, this.startOfToday());
    if (used >= this.dailyQuota) throw new AdvisorQuotaExceededError(this.dailyQuota);

    let conversation = conversationId ? await this.advisor.findConversation(conversationId) : null;
    if (conversationId) {
      if (
        !conversation ||
        conversation.userId !== actorId ||
        conversation.householdId !== householdId
      ) {
        throw new ConversationNotFoundError(conversationId);
      }
    } else {
      conversation = { id: this.ids.next(), householdId, userId: actorId };
      await this.advisor.createConversation(conversation, this.clock.now());
    }
    const history = await this.advisor.recentMessages(conversation.id, HISTORY_LIMIT);
    await this.advisor.appendMessage({
      id: this.ids.next(),
      conversationId: conversation.id,
      role: 'user',
      content: message,
      plan: null,
      createdAt: this.clock.now(),
    });
    const snapshot = await this.snapshots.execute(household, this.today());
    const remainingMessagesToday = Math.max(0, this.dailyQuota - used - 1);
    const { id } = conversation;

    return {
      stream: async (sink, signal) => {
        let plan: Plan | null = null;
        const result = await this.model.chat(
          {
            context: describeHousehold(snapshot),
            history: history.map(({ role, content }) => ({ role, content })),
            message,
            tools: chatTools(snapshot, () => this.ids.next()),
          },
          {
            text: (delta) => sink.text(delta),
            plan: (proposed) => {
              plan = proposed;
              sink.plan(proposed);
            },
          },
          signal,
        );
        if (result.refused) {
          throw new AdvisorUnavailableError('The assistant cannot answer this question.');
        }
        const messageId = this.ids.next();
        await this.advisor.appendMessage({
          id: messageId,
          conversationId: id,
          role: 'assistant',
          content: result.text,
          plan,
          createdAt: this.clock.now(),
        });
        return { conversationId: id, messageId, remainingMessagesToday };
      },
    };
  }
}

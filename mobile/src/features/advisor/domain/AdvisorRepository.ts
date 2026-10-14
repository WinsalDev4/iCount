import type { AdvisorAction, AdvisorConsent, ChatEvent, InsightsReport } from './Advisor';

/**
 * Port for the AI advisor (ADR-0020). The app never talks to the model: the API
 * does, with the household's aggregates. Implementations: InMemoryAdvisorRepository
 * (B-7.1, simulates streaming) and ApiAdvisorRepository (A-7.1, SSE).
 */
export interface AdvisorRepository {
  getConsent(): Promise<AdvisorConsent>;
  setConsent(consent: AdvisorConsent): Promise<AdvisorConsent>;
  insights(householdId: string): Promise<InsightsReport>;
  /**
   * Streams the answer. Iterating yields events until `done` or `error`; breaking
   * out of the loop cancels the request.
   */
  chat(householdId: string, message: string, conversationId?: string): AsyncIterable<ChatEvent>;
  /** Records that the user applied an action (for evaluation of the advisor). */
  recordApplied(
    householdId: string,
    action: AdvisorAction,
    source: { insightId?: string; planId?: string },
  ): Promise<void>;
}

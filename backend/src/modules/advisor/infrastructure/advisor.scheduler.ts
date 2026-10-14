import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { Clock } from '../../../shared/application/clock.js';
import { HouseholdRepository } from '../../households/domain/household.js';
import { BuildInsightsReport } from '../application/insights.use-cases.js';
import {
  ADVISOR_CONSENT_VERSION,
  AdvisorRepository,
  CONVERSATION_RETENTION_DAYS,
} from '../domain/advisor.js';

/**
 * Daily, before people wake up (ADR-0020): insights are computed once per
 * household (the cost of the model is per day, not per screen view) and old
 * conversations are deleted.
 */
@Injectable()
export class AdvisorScheduler {
  private readonly logger = new Logger(AdvisorScheduler.name);

  constructor(
    private readonly advisor: AdvisorRepository,
    private readonly households: HouseholdRepository,
    private readonly build: BuildInsightsReport,
    private readonly clock: Clock,
  ) {}

  @Cron('0 6 * * *', { name: 'advisor-daily', timeZone: 'Europe/Madrid' })
  async run(): Promise<void> {
    try {
      const retention = CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const purged = await this.advisor.purgeConversationsBefore(
        new Date(this.clock.now().getTime() - retention),
      );
      let refreshed = 0;
      for (const id of await this.advisor.householdsWithConsent(ADVISOR_CONSENT_VERSION)) {
        const household = await this.households.findById(id);
        if (!household) continue;
        await this.build.execute(household, true);
        refreshed += 1;
      }
      this.logger.log({ purged, refreshed }, 'Advisor daily job done');
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error), 'Advisor daily job failed');
    }
  }
}

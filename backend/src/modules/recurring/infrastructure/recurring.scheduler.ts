import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { TODAY, type Today } from '../../../shared/application/today.js';
import { MaterializeDueRecurringPayments } from '../application/recurring.use-cases.js';

/**
 * Runs the daily job at 05:00 Spanish time (Spring analogy: @Scheduled(cron = …)).
 * Safe to run more than once and on several instances: the job is idempotent.
 */
@Injectable()
export class RecurringScheduler {
  private readonly logger = new Logger(RecurringScheduler.name);

  constructor(
    private readonly materialize: MaterializeDueRecurringPayments,
    @Inject(TODAY) private readonly today: Today,
  ) {}

  @Cron('0 5 * * *', { name: 'materialize-recurring-payments', timeZone: 'Europe/Madrid' })
  async run(): Promise<void> {
    const today = this.today();
    try {
      const { created } = await this.materialize.execute(today);
      this.logger.log({ today, created }, 'Recurring payments materialised');
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error), 'Recurring job failed');
    }
  }
}

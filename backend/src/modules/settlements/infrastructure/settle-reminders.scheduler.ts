import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SendSettleReminders } from '../application/settlements.use-cases.js';

/** Mondays at 19:00 Spanish time: at most one reminder a week per debtor (ADR-0017). */
@Injectable()
export class SettleRemindersScheduler {
  private readonly logger = new Logger(SettleRemindersScheduler.name);

  constructor(private readonly sendReminders: SendSettleReminders) {}

  @Cron('0 19 * * 1', { name: 'settle-reminders', timeZone: 'Europe/Madrid' })
  async run(): Promise<void> {
    try {
      this.logger.log(await this.sendReminders.execute(), 'Settle reminders sent');
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error), 'Settle reminders failed');
    }
  }
}

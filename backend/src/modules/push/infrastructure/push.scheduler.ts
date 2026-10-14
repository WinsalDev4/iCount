import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CheckPushReceipts } from '../application/push.use-cases.js';

/** Every 30 minutes: read receipts and forget the devices that are gone. */
@Injectable()
export class PushReceiptsScheduler {
  private readonly logger = new Logger(PushReceiptsScheduler.name);

  constructor(private readonly checkReceipts: CheckPushReceipts) {}

  @Cron('*/30 * * * *', { name: 'check-push-receipts' })
  async run(): Promise<void> {
    try {
      const result = await this.checkReceipts.execute();
      if (result.checked > 0) this.logger.log(result, 'Push receipts checked');
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error), 'Push receipts job failed');
    }
  }
}

import { Global, Logger, Module } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';

import { Clock } from '../../shared/application/clock.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { APP_CONFIG, type AppConfig } from '../../shared/config/app-config.js';
import {
  AfterCommitPushNotifications,
  CheckPushReceipts,
  DeliverPushNotification,
  RegisterPushToken,
  UnregisterPushToken,
} from './application/push.use-cases.js';
import {
  PushNotifications,
  PushSender,
  PushTicketRepository,
  PushTokenRepository,
} from './domain/push.js';
import { ExpoPushSender } from './infrastructure/expo-push-sender.js';
import {
  DrizzlePushTicketRepository,
  DrizzlePushTokenRepository,
} from './infrastructure/persistence/drizzle-push.repositories.js';
import { PushReceiptsScheduler } from './infrastructure/push.scheduler.js';
import { PushController } from './interface/http/push.controller.js';

const logger = new Logger('PushNotifications');

/**
 * Device registration, delivery through Expo and receipt cleanup (ADR-0017).
 * Global so transactions and settlements can notify without importing it.
 */
@Global()
@Module({
  controllers: [PushController],
  providers: [
    { provide: PushTokenRepository, useClass: DrizzlePushTokenRepository },
    { provide: PushTicketRepository, useClass: DrizzlePushTicketRepository },
    {
      provide: PushSender,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new ExpoPushSender(
          new Expo(config.push.expoAccessToken ? { accessToken: config.push.expoAccessToken } : {}),
        ),
    },
    {
      provide: RegisterPushToken,
      inject: [PushTokenRepository, Clock],
      useFactory: (...deps: ConstructorParameters<typeof RegisterPushToken>) =>
        new RegisterPushToken(...deps),
    },
    {
      provide: UnregisterPushToken,
      inject: [PushTokenRepository],
      useFactory: (tokens: PushTokenRepository) => new UnregisterPushToken(tokens),
    },
    ...[DeliverPushNotification, CheckPushReceipts].map((UseCase) => ({
      provide: UseCase,
      inject: [PushTokenRepository, PushTicketRepository, PushSender, Clock],
      useFactory: (
        tokens: PushTokenRepository,
        tickets: PushTicketRepository,
        sender: PushSender,
        clock: Clock,
      ) => new UseCase(tokens, tickets, sender, clock),
    })),
    {
      provide: PushNotifications,
      inject: [TransactionRunner, DeliverPushNotification],
      useFactory: (runner: TransactionRunner, deliver: DeliverPushNotification) =>
        new AfterCommitPushNotifications(runner, deliver, (error) =>
          logger.error(error instanceof Error ? error : String(error), 'Push delivery failed'),
        ),
    },
    PushReceiptsScheduler,
  ],
  exports: [PushNotifications],
})
export class PushModule {}

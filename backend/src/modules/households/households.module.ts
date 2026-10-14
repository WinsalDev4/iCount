import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { TransactionRunner } from '../../shared/application/transaction-runner.js';
import { ActivityLog } from '../activity/domain/activity.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserRepository } from '../auth/domain/user.js';
import {
  CreateHousehold,
  CreateInvitation,
  GetHousehold,
  InviteCodeGenerator,
  JoinHousehold,
  ListMyHouseholds,
  SetMyIncome,
  SetSplitRule,
} from './application/households.use-cases.js';
import { HouseholdAccess } from './application/household-access.js';
import { HouseholdRepository } from './domain/household.js';
import { InvitationRepository } from './domain/invitation.js';
import {
  DrizzleHouseholdRepository,
  DrizzleInvitationRepository,
} from './infrastructure/persistence/drizzle-households.repositories.js';
import { RandomInviteCodes } from './infrastructure/random-invite-codes.js';
import { HouseholdsController } from './interface/http/households.controller.js';

/** Households, members, invitations and split rules. Exports the repository for other modules. */
@Module({
  imports: [AuthModule],
  controllers: [HouseholdsController],
  providers: [
    { provide: HouseholdRepository, useClass: DrizzleHouseholdRepository },
    { provide: InvitationRepository, useClass: DrizzleInvitationRepository },
    { provide: InviteCodeGenerator, useClass: RandomInviteCodes },
    {
      provide: HouseholdAccess,
      inject: [HouseholdRepository],
      useFactory: (households: HouseholdRepository) => new HouseholdAccess(households),
    },
    {
      provide: CreateHousehold,
      inject: [HouseholdRepository, UserRepository, Clock, IdGenerator],
      useFactory: (...deps: ConstructorParameters<typeof CreateHousehold>) =>
        new CreateHousehold(...deps),
    },
    {
      provide: ListMyHouseholds,
      inject: [HouseholdRepository],
      useFactory: (households: HouseholdRepository) => new ListMyHouseholds(households),
    },
    {
      provide: GetHousehold,
      inject: [HouseholdRepository],
      useFactory: (households: HouseholdRepository) => new GetHousehold(households),
    },
    {
      provide: CreateInvitation,
      inject: [HouseholdRepository, InvitationRepository, InviteCodeGenerator, Clock, IdGenerator],
      useFactory: (...deps: ConstructorParameters<typeof CreateInvitation>) =>
        new CreateInvitation(...deps),
    },
    {
      provide: JoinHousehold,
      inject: [
        HouseholdRepository,
        InvitationRepository,
        UserRepository,
        TransactionRunner,
        Clock,
        ActivityLog,
      ],
      useFactory: (...deps: ConstructorParameters<typeof JoinHousehold>) =>
        new JoinHousehold(...deps),
    },
    {
      provide: SetSplitRule,
      inject: [HouseholdRepository],
      useFactory: (households: HouseholdRepository) => new SetSplitRule(households),
    },
    {
      provide: SetMyIncome,
      inject: [HouseholdRepository],
      useFactory: (households: HouseholdRepository) => new SetMyIncome(households),
    },
  ],
  exports: [HouseholdRepository, HouseholdAccess],
})
export class HouseholdsModule {}

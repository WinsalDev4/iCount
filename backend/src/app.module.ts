import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HouseholdsModule } from './modules/households/households.module.js';
import { NotesModule } from './modules/notes/notes.module.js';
import { SharedKernelModule } from './shared/application/shared-kernel.module.js';
import { AuthCoreModule } from './shared/auth/auth-core.module.js';
import { JwtAuthGuard } from './shared/auth/jwt-auth.guard.js';
import type { AppConfig } from './shared/config/app-config.js';
import { ConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { EmailModule } from './shared/email/email.module.js';
import { ProblemDetailsFilter } from './shared/interface/http/problem-details.filter.js';
import { createLoggerModule } from './shared/logging/logger.module.js';

/**
 * Root module. It receives the already-validated config, so nothing starts
 * with a bad environment (Spring analogy: the @SpringBootApplication class).
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    const featureModules = [
      HealthModule,
      AuthModule,
      HouseholdsModule,
      // The template module is a reference for new modules, not a product feature.
      ...(config.nodeEnv === 'production' ? [] : [NotesModule]),
    ];

    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        createLoggerModule(config),
        DatabaseModule,
        SharedKernelModule,
        AuthCoreModule,
        EmailModule,
        ...featureModules,
      ],
      providers: [
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        // Secure by default: every route needs a token unless marked @Public().
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    };
  }
}

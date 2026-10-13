import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { HealthModule } from './modules/health/health.module.js';
import { NotesModule } from './modules/notes/notes.module.js';
import { SharedKernelModule } from './shared/application/shared-kernel.module.js';
import type { AppConfig } from './shared/config/app-config.js';
import { ConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
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
        ...featureModules,
      ],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}

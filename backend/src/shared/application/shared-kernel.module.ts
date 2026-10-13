import { Global, Module } from '@nestjs/common';

import { Clock, SystemClock } from './clock.js';
import { IdGenerator, RandomUuidGenerator } from './id-generator.js';

/** Cross-cutting application ports with their production implementations. */
@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: RandomUuidGenerator },
  ],
  exports: [Clock, IdGenerator],
})
export class SharedKernelModule {}

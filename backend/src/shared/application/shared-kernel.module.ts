import { Global, Module } from '@nestjs/common';

import { Clock, SystemClock } from './clock.js';
import { IdGenerator, RandomUuidGenerator } from './id-generator.js';
import { TODAY, todayIn } from './today.js';

/** Cross-cutting application ports with their production implementations. */
@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: RandomUuidGenerator },
    { provide: TODAY, inject: [Clock], useFactory: (clock: Clock) => todayIn(clock) },
  ],
  exports: [Clock, IdGenerator, TODAY],
})
export class SharedKernelModule {}

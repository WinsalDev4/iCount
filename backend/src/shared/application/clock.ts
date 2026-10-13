/** Port for "now" so use cases are deterministic in tests (like java.time.Clock). */
export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

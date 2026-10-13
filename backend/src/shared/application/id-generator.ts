import { randomUUID } from 'node:crypto';

/** Port for new identifiers so use cases are deterministic in tests. */
export abstract class IdGenerator {
  abstract next(): string;
}

export class RandomUuidGenerator extends IdGenerator {
  next(): string {
    return randomUUID();
  }
}

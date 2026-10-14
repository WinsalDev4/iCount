import { AsyncLocalStorage } from 'node:async_hooks';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';

import { TransactionRunner } from '../application/transaction-runner.js';
import { DATABASE, type Database } from './database.tokens.js';

/** What repositories query: the pool, or the open transaction of the current unit of work. */
export type DbExecutor = PgDatabase<NodePgQueryResultHKT>;

interface UnitOfWork {
  readonly tx: DbExecutor;
  readonly afterCommit: (() => void)[];
}

/**
 * Keeps the current transaction in AsyncLocalStorage (like a ThreadLocal in
 * Spring's TransactionSynchronizationManager), so repositories join it without
 * passing a `tx` parameter through every use case.
 */
@Injectable()
export class DatabaseContext extends TransactionRunner {
  private readonly logger = new Logger(DatabaseContext.name);
  private readonly storage = new AsyncLocalStorage<UnitOfWork>();

  constructor(@Inject(DATABASE) private readonly root: Database) {
    super();
  }

  /** The executor repositories must use for every query. */
  get db(): DbExecutor {
    return this.storage.getStore()?.tx ?? this.root;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    // Nested calls join the outer transaction instead of opening another one.
    if (this.storage.getStore()) return work();
    const effects: (() => void)[] = [];
    const result = await this.root.transaction((tx) =>
      this.storage.run({ tx, afterCommit: effects }, work),
    );
    for (const effect of effects) this.runEffect(effect);
    return result;
  }

  afterCommit(effect: () => void): void {
    const unit = this.storage.getStore();
    if (unit) unit.afterCommit.push(effect);
    else this.runEffect(effect);
  }

  /** An effect failing must not turn a committed change into an error response. */
  private runEffect(effect: () => void): void {
    try {
      effect();
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : String(error),
        'After-commit effect failed',
      );
    }
  }
}

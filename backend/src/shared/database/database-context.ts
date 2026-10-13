import { AsyncLocalStorage } from 'node:async_hooks';

import { Inject, Injectable } from '@nestjs/common';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';

import { TransactionRunner } from '../application/transaction-runner.js';
import { DATABASE, type Database } from './database.tokens.js';

/** What repositories query: the pool, or the open transaction of the current unit of work. */
export type DbExecutor = PgDatabase<NodePgQueryResultHKT>;

/**
 * Keeps the current transaction in AsyncLocalStorage (like a ThreadLocal in
 * Spring's TransactionSynchronizationManager), so repositories join it without
 * passing a `tx` parameter through every use case.
 */
@Injectable()
export class DatabaseContext extends TransactionRunner {
  private readonly storage = new AsyncLocalStorage<DbExecutor>();

  constructor(@Inject(DATABASE) private readonly root: Database) {
    super();
  }

  /** The executor repositories must use for every query. */
  get db(): DbExecutor {
    return this.storage.getStore() ?? this.root;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    // Nested calls join the outer transaction instead of opening another one.
    if (this.storage.getStore()) return work();
    return this.root.transaction((tx) => this.storage.run(tx, work));
  }
}

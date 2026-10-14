import { InMemoryTransactionRepository } from './InMemoryTransactionRepository';

/**
 * ONE in-memory transaction store per app run, shared by every in-memory adapter that needs to
 * read the movements (budgets compute "spent" from them, recurring payments will post to them).
 *
 * Without a backend there is no common database, so two adapters creating their own repository
 * would see different data. With the real API this file is never used.
 */
let shared: InMemoryTransactionRepository | undefined;

export function sharedMemoryTransactionRepository(): InMemoryTransactionRepository {
  shared ??= new InMemoryTransactionRepository();
  return shared;
}

/** Starts from scratch: tests, and "sign out" in memory mode. */
export function resetSharedMemoryTransactionRepository(): void {
  shared = undefined;
}

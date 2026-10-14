/**
 * Port for a unit of work: everything the repositories do inside `run` commits
 * or rolls back together. Use cases depend on this, never on the database.
 * Spring analogy: `@Transactional` / `TransactionTemplate.execute`.
 */
export abstract class TransactionRunner {
  abstract run<T>(work: () => Promise<T>): Promise<T>;

  /**
   * Runs `effect` once the current unit of work has committed (never if it rolls
   * back); outside a unit of work, right away. For side effects that cannot be
   * undone, such as push notifications. Spring analogy:
   * `TransactionSynchronization.afterCommit`.
   */
  abstract afterCommit(effect: () => void): void;
}

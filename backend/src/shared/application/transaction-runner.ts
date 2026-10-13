/**
 * Port for a unit of work: everything the repositories do inside `run` commits
 * or rolls back together. Use cases depend on this, never on the database.
 * Spring analogy: `@Transactional` / `TransactionTemplate.execute`.
 */
export abstract class TransactionRunner {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}

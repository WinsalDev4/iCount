/** Expected budget failures, translated from transport errors by repositories. */
export type BudgetErrorReason =
  'duplicate' | 'not-found' | 'insufficient-amount' | 'invalid' | 'network' | 'unknown';

export class BudgetError extends Error {
  constructor(
    readonly reason: BudgetErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'BudgetError';
  }
}

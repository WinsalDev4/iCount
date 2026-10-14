/** Expected failures of movement operations, translated from transport errors by repositories. */
export type TransactionErrorReason = 'not-found' | 'forbidden' | 'invalid' | 'network' | 'unknown';

export class TransactionError extends Error {
  constructor(
    readonly reason: TransactionErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

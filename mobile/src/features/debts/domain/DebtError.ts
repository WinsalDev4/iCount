/** Expected debt failures, translated from transport errors by repositories. */
export type DebtErrorReason = 'not-found' | 'invalid' | 'network' | 'unknown';

export class DebtError extends Error {
  constructor(
    readonly reason: DebtErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'DebtError';
  }
}

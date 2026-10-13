/** Expected recurring-payment failures, translated from transport errors by repositories. */
export type RecurringErrorReason = 'not-found' | 'invalid' | 'network' | 'unknown';

export class RecurringError extends Error {
  constructor(
    readonly reason: RecurringErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'RecurringError';
  }
}

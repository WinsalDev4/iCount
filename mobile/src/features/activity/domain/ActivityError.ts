/** Expected activity failures, translated from transport errors by repositories. */
export type ActivityErrorReason =
  'not-found' | 'already-decided' | 'cannot-approve-own' | 'forbidden' | 'network' | 'unknown';

export class ActivityError extends Error {
  constructor(
    readonly reason: ActivityErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'ActivityError';
  }
}

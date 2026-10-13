/** Expected household failures, translated from transport errors by repositories. */
export type HouseholdErrorReason =
  | 'invalid-invite'
  | 'expired-invite'
  | 'already-member'
  | 'not-found'
  | 'forbidden'
  | 'invalid-split-rule'
  | 'network'
  | 'unknown';

export class HouseholdError extends Error {
  constructor(
    readonly reason: HouseholdErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'HouseholdError';
  }
}

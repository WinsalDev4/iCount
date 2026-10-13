/** Expected settlement failures, translated from transport errors by repositories. */
export type SettlementErrorReason = 'invalid' | 'forbidden' | 'network' | 'unknown';

export class SettlementError extends Error {
  constructor(
    readonly reason: SettlementErrorReason,
    message: string = reason,
  ) {
    super(message);
    this.name = 'SettlementError';
  }
}

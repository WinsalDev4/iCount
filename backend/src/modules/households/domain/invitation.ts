/** Single-use code to join a shared household (8 characters, 48 h). */
export interface Invitation {
  readonly id: string;
  readonly householdId: string;
  readonly code: string;
  readonly createdBy: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;
}

export abstract class InvitationRepository {
  /** False when the code already exists (the caller retries with a new one). */
  abstract create(invitation: Invitation): Promise<boolean>;
  abstract findByCode(code: string): Promise<Invitation | null>;
  /** Atomically marks it as used by `userId`; false if someone used it first. */
  abstract markUsed(id: string, userId: string, now: Date): Promise<boolean>;
}

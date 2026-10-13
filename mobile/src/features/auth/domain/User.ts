import type { UserId } from '@/core/domain/Ids';

export interface User {
  readonly id: UserId;
  readonly email: string;
  /** Null until the user chooses one. */
  readonly displayName: string | null;
}

/**
 * The signed-in user as the rest of the app sees it. Tokens are not part of the
 * domain: they live in core/auth (A-2.3) and never reach ViewModels.
 */
export interface Session {
  readonly user: User;
}

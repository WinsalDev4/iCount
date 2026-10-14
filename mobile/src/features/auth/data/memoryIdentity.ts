import type { UserId } from '@/core/domain/Ids';

export interface MemoryIdentity {
  readonly userId: UserId;
  readonly email: string;
  readonly displayName: string | null;
}

/**
 * Who is signed in, for the in-memory adapters only (`EXPO_PUBLIC_DATA_SOURCE=memory`).
 *
 * Without a backend nobody tells the household and transaction repositories who "me" is, and
 * they would invent different people. The in-memory auth repository publishes the identity here
 * when a link is verified; the other in-memory repositories read it. With the real API the
 * server knows the caller and none of this is used.
 */
let current: MemoryIdentity | null = null;

export function setMemoryIdentity(identity: MemoryIdentity | null): void {
  current = identity;
}

export function getMemoryIdentity(): MemoryIdentity | null {
  return current;
}

/** Used before anybody signed in (tests, the first frames of the app). */
export const FALLBACK_MEMORY_IDENTITY: MemoryIdentity = {
  userId: 'user-me' as UserId,
  email: 'tu@icount.app',
  displayName: null,
};

export function currentMemoryIdentity(): MemoryIdentity {
  return current ?? FALLBACK_MEMORY_IDENTITY;
}

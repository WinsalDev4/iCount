import type { Member } from '../domain/Household';

/** "Ana" · the part of the email before the @ when there is no name · "Alguien" if unknown. */
export function memberLabel(member: Member): string {
  return member.displayName?.trim() || member.email.split('@')[0] || 'Alguien';
}

/**
 * Resolves a user id to the name shown in sentences; the signed-in person is "Tú".
 * Ids that are no longer members (someone who left) read "Alguien".
 */
export function createNameOf(members: readonly Member[], meId: string | undefined) {
  const labels = new Map(members.map((m) => [m.userId as string, memberLabel(m)]));
  return (userId: string): string => (userId === meId ? 'Tú' : (labels.get(userId) ?? 'Alguien'));
}

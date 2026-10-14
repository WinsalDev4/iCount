/** Invitation codes have 8 characters, A–Z and 0–9 (see `Invitation` in Household.ts). */
export const INVITE_CODE_LENGTH = 8;

/** What the person typed → what the API expects: uppercase, no spaces or dashes. */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidInviteCode(raw: string): boolean {
  return new RegExp(`^[A-Z0-9]{${INVITE_CODE_LENGTH}}$`).test(normalizeInviteCode(raw));
}

/** Easier to read aloud or retype: `ABCD2345` → `ABCD-2345`. */
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  const half = Math.floor(normalized.length / 2);
  return `${normalized.slice(0, half)}-${normalized.slice(half)}`;
}

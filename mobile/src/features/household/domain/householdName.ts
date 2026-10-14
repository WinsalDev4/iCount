export const MAX_HOUSEHOLD_NAME_LENGTH = 60;

export function normalizeHouseholdName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidHouseholdName(raw: string): boolean {
  const name = normalizeHouseholdName(raw);
  return name.length > 0 && name.length <= MAX_HOUSEHOLD_NAME_LENGTH;
}

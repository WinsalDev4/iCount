import { z } from 'zod';

/** Minimal secure key-value storage (Keychain / Keystore). Port so tests need no native code. */
export interface SecureKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

const storedSessionSchema = z.object({
  refreshToken: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    email: z.string().min(1),
    displayName: z.string().nullable(),
  }),
});

/**
 * What survives an app restart: the refresh token and who is signed in (to show
 * the app offline). The access token is never persisted (ADR-0013).
 */
export type StoredSession = z.infer<typeof storedSessionSchema>;

/** Versioned key: a future format change can migrate or simply sign out cleanly. */
export const SESSION_KEY = 'icount.session.v1';

export class SessionStore {
  constructor(private readonly storage: SecureKeyValueStorage) {}

  async load(): Promise<StoredSession | null> {
    const raw = await this.storage.getItem(SESSION_KEY);
    if (raw === null) return null;
    try {
      const parsed = storedSessionSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Corrupt JSON: fall through and treat it as signed out.
    }
    await this.clear();
    return null;
  }

  save(session: StoredSession): Promise<void> {
    return this.storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  clear(): Promise<void> {
    return this.storage.deleteItem(SESSION_KEY);
  }
}

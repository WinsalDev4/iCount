import type { AuthRepository } from '../AuthRepository';
import type { Session } from '../User';

/** The session stored on this device, if any (no network needed). */
export class GetSession {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<Session | null> {
    return this.repository.getSession();
  }
}

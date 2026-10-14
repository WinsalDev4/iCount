import type { AuthRepository } from '../AuthRepository';

export class SignOut {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<void> {
    return this.repository.signOut();
  }
}

import { expoBiometrics } from '@/core/auth/biometrics';
import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import { InMemoryAuthRepository } from './data/InMemoryAuthRepository';
import type { AuthRepository } from './domain/AuthRepository';
import { GetSession } from './domain/usecases/GetSession';
import { RequestMagicLink } from './domain/usecases/RequestMagicLink';
import { SignOut } from './domain/usecases/SignOut';
import { VerifyMagicLink } from './domain/usecases/VerifyMagicLink';

export interface AuthModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Feature module: repository → use cases. `memory` signs in with any token; the `api` source
 * is chosen in the 2.9 integration (ApiAuthRepository needs the shared clients from
 * core/auth/createApiClients, which the container owns), so for now it stays a stub.
 */
export function createAuthModule(config: AuthModuleConfig) {
  const repository: AuthRepository =
    config.dataSource === 'memory'
      ? new InMemoryAuthRepository()
      : notImplemented<AuthRepository>(`auth(${config.dataSource}).authRepository`);

  return {
    authRepository: repository,
    requestMagicLink: new RequestMagicLink(repository),
    verifyMagicLink: new VerifyMagicLink(repository),
    signOut: new SignOut(repository),
    getSession: new GetSession(repository),
    /** Local unlock only; it never talks to the server. */
    biometrics: expoBiometrics,
  };
}

export type AuthModule = ReturnType<typeof createAuthModule>;

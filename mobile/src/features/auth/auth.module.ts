import { expoBiometrics } from '@/core/auth/biometrics';
import { type FeatureContext, requireApi } from '@/core/di/FeatureContext';

import { ApiAuthRepository } from './data/api/ApiAuthRepository';
import { InMemoryAuthRepository } from './data/InMemoryAuthRepository';
import type { AuthRepository } from './domain/AuthRepository';
import { GetSession } from './domain/usecases/GetSession';
import { RequestMagicLink } from './domain/usecases/RequestMagicLink';
import { SignOut } from './domain/usecases/SignOut';
import { VerifyMagicLink } from './domain/usecases/VerifyMagicLink';

/**
 * Feature module: repository → use cases. `memory` signs in with any token; `api` uses the
 * public client (auth endpoints) and the device session the container owns.
 */
export function createAuthModule(context: FeatureContext) {
  const repository = createRepository(context);

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

function createRepository(context: FeatureContext): AuthRepository {
  if (context.dataSource === 'memory') return new InMemoryAuthRepository();
  const { publicHttp, session } = requireApi(context, 'auth');
  return new ApiAuthRepository(publicHttp, session);
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import type { BiometricAuthenticator } from '@/core/auth/biometrics';
import { createContainer } from '@/core/di/container';
import { DependenciesProvider } from '@/core/di/DependenciesProvider';

import { InMemoryAuthRepository } from '../data/InMemoryAuthRepository';
import type { AuthRepository } from '../domain/AuthRepository';
import { GetSession } from '../domain/usecases/GetSession';
import { RequestMagicLink } from '../domain/usecases/RequestMagicLink';
import { SignOut } from '../domain/usecases/SignOut';
import { VerifyMagicLink } from '../domain/usecases/VerifyMagicLink';

/** Test double with controllable answers; `jest.fn` so tests can assert on calls. */
export function fakeBiometrics({ available = true, passes = true } = {}): BiometricAuthenticator & {
  isAvailable: jest.Mock;
  authenticate: jest.Mock;
} {
  return {
    isAvailable: jest.fn().mockResolvedValue(available),
    authenticate: jest.fn().mockResolvedValue(passes),
  };
}

/**
 * Wires a throw-away container + QueryClient around a hook under test: the real use cases over
 * the given repository (in-memory by default) and a fake biometric sensor.
 */
export function createAuthTestKit(
  options: { repository?: AuthRepository; biometrics?: BiometricAuthenticator } = {},
) {
  const repository = options.repository ?? new InMemoryAuthRepository();
  const biometrics = options.biometrics ?? fakeBiometrics();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });

  const base = createContainer({ dataSource: 'memory' });
  const container = {
    ...base,
    auth: {
      authRepository: repository,
      requestMagicLink: new RequestMagicLink(repository),
      verifyMagicLink: new VerifyMagicLink(repository),
      signOut: new SignOut(repository),
      getSession: new GetSession(repository),
      biometrics,
    },
  };

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DependenciesProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DependenciesProvider>
    );
  }

  return { Wrapper, queryClient, repository, biometrics };
}

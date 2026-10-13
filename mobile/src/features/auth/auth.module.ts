import type { DataSource } from '@/core/config/env';
import { notImplemented } from '@/core/di/notImplemented';

import type { AuthRepository } from './domain/AuthRepository';

export interface AuthModuleConfig {
  readonly dataSource: DataSource;
}

/**
 * Stub from task 2.0 so the container already composes it.
 * B-2.2 wires InMemoryAuthRepository and the use cases; 2.9 picks
 * ApiAuthRepository when `dataSource === 'api'`.
 */
export function createAuthModule(config: AuthModuleConfig) {
  return {
    authRepository: notImplemented<AuthRepository>(`auth(${config.dataSource}).authRepository`),
  };
}

export type AuthModule = ReturnType<typeof createAuthModule>;

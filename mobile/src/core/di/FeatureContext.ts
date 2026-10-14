import type { ApiClients } from '@/core/auth/createApiClients';
import type { DataSource } from '@/core/config/env';

/**
 * What the container hands to every feature module. `api` exists only when
 * `dataSource === 'api'`: one session and one pair of HTTP clients for the whole
 * app (Hilt analogy: @Singleton OkHttpClient/Retrofit shared by every repository).
 */
export interface FeatureContext {
  readonly dataSource: DataSource;
  readonly api: ApiClients | null;
}

/** The shared API clients, or a clear error if a module is wired to `api` without them. */
export function requireApi(context: FeatureContext, feature: string): ApiClients {
  if (!context.api) throw new Error(`${feature}: the "api" data source needs the API clients`);
  return context.api;
}

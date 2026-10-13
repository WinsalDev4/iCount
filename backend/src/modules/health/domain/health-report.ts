export type DependencyHealth =
  | { readonly status: 'up'; readonly latencyMs: number }
  | { readonly status: 'down'; readonly reason: string };

export interface HealthReport {
  readonly status: 'ok' | 'error';
  readonly checks: { readonly database: DependencyHealth };
}

/** Port: anything that can tell whether the database answers. */
export abstract class DatabaseHealthIndicator {
  abstract ping(): Promise<void>;
}

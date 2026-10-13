import type {
  DatabaseHealthIndicator,
  DependencyHealth,
  HealthReport,
} from '../domain/health-report.js';

export const DEFAULT_HEALTH_TIMEOUT_MS = 2_000;

/** Checks every dependency the API needs to serve traffic (today: PostgreSQL). */
export class CheckHealth {
  constructor(
    private readonly database: DatabaseHealthIndicator,
    private readonly timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
  ) {}

  async execute(): Promise<HealthReport> {
    const database = await this.probe(() => this.database.ping());
    return { status: database.status === 'up' ? 'ok' : 'error', checks: { database } };
  }

  private async probe(ping: () => Promise<void>): Promise<DependencyHealth> {
    const startedAt = performance.now();
    try {
      await withTimeout(ping(), this.timeoutMs);
      return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      return { status: 'down', reason: error instanceof Error ? error.message : String(error) };
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

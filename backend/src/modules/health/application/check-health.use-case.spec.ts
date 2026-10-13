import { DatabaseHealthIndicator } from '../domain/health-report.js';
import { CheckHealth } from './check-health.use-case.js';

class FakeDatabase extends DatabaseHealthIndicator {
  constructor(private readonly behaviour: () => Promise<void>) {
    super();
  }

  ping(): Promise<void> {
    return this.behaviour();
  }
}

describe('CheckHealth', () => {
  it('is ok when the database answers', async () => {
    const report = await new CheckHealth(new FakeDatabase(async () => undefined)).execute();

    expect(report.status).toBe('ok');
    expect(report.checks.database).toMatchObject({ status: 'up' });
  });

  it('reports the database down when the ping fails', async () => {
    const failing = new FakeDatabase(() => Promise.reject(new Error('ECONNREFUSED')));

    const report = await new CheckHealth(failing).execute();

    expect(report).toEqual({
      status: 'error',
      checks: { database: { status: 'down', reason: 'ECONNREFUSED' } },
    });
  });

  it('gives up on a database that hangs', async () => {
    const hanging = new FakeDatabase(() => new Promise(() => undefined));

    const report = await new CheckHealth(hanging, 20).execute();

    expect(report.checks.database).toEqual({ status: 'down', reason: 'Timed out after 20 ms' });
  });
});

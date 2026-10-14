import { createTransactionsModule } from '../transactions.module';

describe('createTransactionsModule', () => {
  it('wires the use cases against the in-memory repository', async () => {
    const { getMonthlySummary } = createTransactionsModule({ dataSource: 'memory', api: null });
    const now = new Date();

    const summary = await getMonthlySummary.execute('home', {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });

    expect(summary.income.amountMinor).toBeGreaterThan(0);
  });

  it('refuses the api data source without the shared API clients', () => {
    expect(() => createTransactionsModule({ dataSource: 'api', api: null })).toThrow(
      'needs the API clients',
    );
  });
});

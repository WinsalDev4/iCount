import { createTransactionsModule } from '../transactions.module';

describe('createTransactionsModule', () => {
  it('wires the use cases against the in-memory repository', async () => {
    const { getMonthlySummary } = createTransactionsModule({ dataSource: 'memory' });
    const now = new Date();

    const summary = await getMonthlySummary.execute('home', {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });

    expect(summary.income.amountMinor).toBeGreaterThan(0);
  });

  it('refuses the api data source until its repository exists', () => {
    expect(() => createTransactionsModule({ dataSource: 'api' })).toThrow('not available yet');
  });
});

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

  it('leaves the api data source to the 3.9 integration', () => {
    expect(() => createTransactionsModule({ dataSource: 'api' })).toThrow('3.9 integration');
  });
});

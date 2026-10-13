import { createContainer } from '../container';

describe('createContainer', () => {
  it('composes every feature module without calling any port', () => {
    const container = createContainer({ dataSource: 'memory' });

    expect(Object.keys(container)).toEqual(
      expect.arrayContaining([
        'auth',
        'budgets',
        'categories',
        'debts',
        'household',
        'recurring',
        'transactions',
      ]),
    );
  });
});

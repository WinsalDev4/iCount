import { createContainer } from '../container';

describe('createContainer', () => {
  it('composes every feature module without calling any port', () => {
    const container = createContainer({ dataSource: 'memory' });

    expect(Object.keys(container)).toEqual(
      expect.arrayContaining([
        'activity',
        'advisor',
        'auth',
        'budgets',
        'categories',
        'debts',
        'household',
        'push',
        'recurring',
        'settlements',
        'transactions',
      ]),
    );
  });
});

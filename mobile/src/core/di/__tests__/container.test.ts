import { ApiAuthRepository } from '@/features/auth/data/api/ApiAuthRepository';
import { InMemoryAuthRepository } from '@/features/auth/data/InMemoryAuthRepository';
import { ApiCategoryRepository } from '@/features/categories/data/api/ApiCategoryRepository';
import { ApiHouseholdRepository } from '@/features/household/data/api/ApiHouseholdRepository';
import { ApiTransactionRepository } from '@/features/transactions/data/api/ApiTransactionRepository';

import { createContainer } from '../container';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

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

  it('memory: no device session and in-memory repositories', () => {
    const container = createContainer({ dataSource: 'memory' });

    expect(container.session).toBeNull();
    expect(container.auth.authRepository).toBeInstanceOf(InMemoryAuthRepository);
  });

  it('api: one shared session and the API repositories of the integrated phases', () => {
    const container = createContainer({ dataSource: 'api', apiUrl: 'http://10.0.2.2:3000' });

    expect(container.session).not.toBeNull();
    expect(container.auth.authRepository).toBeInstanceOf(ApiAuthRepository);
    expect(container.household.householdRepository).toBeInstanceOf(ApiHouseholdRepository);
    expect(container.categories.categoryRepository).toBeInstanceOf(ApiCategoryRepository);
    expect(container.transactions.transactionRepository).toBeInstanceOf(ApiTransactionRepository);
  });
});

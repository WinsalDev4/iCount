import { createContainer } from '../container';

describe('createContainer', () => {
  it('composes every feature module without touching unimplemented ports', () => {
    const container = createContainer({ dataSource: 'memory' });

    expect(Object.keys(container).sort()).toEqual(['auth', 'household', 'transactions']);
  });

  it('exposes phase 2 ports as stubs until their tasks land', async () => {
    const { auth, household } = createContainer({ dataSource: 'memory' });

    await expect(auth.authRepository.getSession()).rejects.toThrow('not implemented yet');
    await expect(household.householdRepository.getMine()).rejects.toThrow('not implemented yet');
  });
});

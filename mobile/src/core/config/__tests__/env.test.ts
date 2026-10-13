import { parseEnv } from '../env';

describe('parseEnv', () => {
  it('defaults to the in-memory data source', () => {
    expect(parseEnv({}).dataSource).toBe('memory');
    expect(parseEnv({ EXPO_PUBLIC_DATA_SOURCE: '' }).dataSource).toBe('memory');
  });

  it('accepts the api data source', () => {
    expect(parseEnv({ EXPO_PUBLIC_DATA_SOURCE: 'api' }).dataSource).toBe('api');
  });

  it('fails fast on unknown values', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_DATA_SOURCE: 'mock' })).toThrow();
  });
});

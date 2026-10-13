import { DEFAULT_API_URL, parseEnv } from '../env';

describe('parseEnv', () => {
  it('defaults to the in-memory data source and the local API', () => {
    expect(parseEnv({})).toEqual({ dataSource: 'memory', apiUrl: DEFAULT_API_URL });
    expect(parseEnv({ EXPO_PUBLIC_DATA_SOURCE: '', EXPO_PUBLIC_API_URL: '' })).toEqual({
      dataSource: 'memory',
      apiUrl: DEFAULT_API_URL,
    });
  });

  it('reads the api data source and URL', () => {
    expect(
      parseEnv({ EXPO_PUBLIC_DATA_SOURCE: 'api', EXPO_PUBLIC_API_URL: 'http://10.0.2.2:3000' }),
    ).toEqual({ dataSource: 'api', apiUrl: 'http://10.0.2.2:3000' });
  });

  it('fails fast on unknown values', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_DATA_SOURCE: 'mock' })).toThrow();
    expect(() => parseEnv({ EXPO_PUBLIC_API_URL: 'not a url' })).toThrow();
    expect(() => parseEnv({ EXPO_PUBLIC_API_URL: 'ftp://api.icount.app' })).toThrow();
  });
});

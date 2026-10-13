import { InvalidConfigError, loadConfig } from './app-config.js';

const DATABASE_URL = 'postgres://icount:icount@localhost:5432/icount';

describe('loadConfig', () => {
  it('applies defaults to optional variables', () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: DATABASE_URL,
      logLevel: 'info',
    });
  });

  it('coerces the port and treats empty values as unset', () => {
    expect(loadConfig({ DATABASE_URL, PORT: '8080' }).port).toBe(8080);
    expect(loadConfig({ DATABASE_URL, PORT: '' }).port).toBe(3000);
  });

  it('fails fast with every problem listed', () => {
    const load = () => loadConfig({ DATABASE_URL: 'mysql://nope', PORT: 'abc' });
    expect(load).toThrow(InvalidConfigError);
    expect(load).toThrow(/DATABASE_URL[\s\S]*PORT|PORT[\s\S]*DATABASE_URL/);
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});

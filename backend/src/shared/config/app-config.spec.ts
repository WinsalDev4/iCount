import { InvalidConfigError, loadConfig } from './app-config.js';

const DATABASE_URL = 'postgres://icount:icount@localhost:5432/icount';
const JWT_SECRET = 'test-secret-with-at-least-32-characters!!';
const required = { DATABASE_URL, JWT_SECRET };

describe('loadConfig', () => {
  it('applies defaults to optional variables', () => {
    expect(loadConfig(required)).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: DATABASE_URL,
      logLevel: 'info',
      auth: {
        jwtSecret: JWT_SECRET,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlDays: 30,
        magicLinkTtlMinutes: 15,
        magicLinkUrl: 'icount://auth/verify',
      },
      mail: { smtpUrl: 'smtp://localhost:1025', from: 'iCount <no-reply@icount.local>' },
      push: { expoAccessToken: null },
    });
  });

  it('reads the optional Expo access token', () => {
    expect(loadConfig({ ...required, EXPO_ACCESS_TOKEN: 'expo-token' }).push).toEqual({
      expoAccessToken: 'expo-token',
    });
  });

  it('coerces the port and treats empty values as unset', () => {
    expect(loadConfig({ ...required, PORT: '8080' }).port).toBe(8080);
    expect(loadConfig({ ...required, PORT: '' }).port).toBe(3000);
  });

  it('fails fast with every problem listed', () => {
    const load = () => loadConfig({ ...required, DATABASE_URL: 'mysql://nope', PORT: 'abc' });
    expect(load).toThrow(InvalidConfigError);
    expect(load).toThrow(/DATABASE_URL[\s\S]*PORT|PORT[\s\S]*DATABASE_URL/);
  });

  it('requires DATABASE_URL and a long enough JWT_SECRET', () => {
    expect(() => loadConfig({ JWT_SECRET })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});

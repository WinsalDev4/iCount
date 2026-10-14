import { NodeSecureTokens } from './node-secure-tokens.js';

describe('NodeSecureTokens', () => {
  const tokens = new NodeSecureTokens();

  it('generates long, URL-safe and unique tokens', () => {
    const generated = new Set(Array.from({ length: 100 }, () => tokens.generate()));

    expect(generated.size).toBe(100);
    for (const token of generated) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes deterministically to SHA-256 hex', () => {
    expect(tokens.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

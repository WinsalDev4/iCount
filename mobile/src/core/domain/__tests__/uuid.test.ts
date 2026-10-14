import { uuidV4 } from '../uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV4', () => {
  it('is a valid, unique v4 UUID, also without crypto.randomUUID', () => {
    const native = uuidV4();
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const fallback = new Set(Array.from({ length: 1_000 }, uuidV4));
      expect(fallback.size).toBe(1_000);
      for (const id of fallback) expect(id).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
    expect(native).toMatch(UUID_V4);
  });
});

import { Money } from '@/core/domain/Money';

import { deserializeCache, serializeCache } from '../cacheSerialization';

describe('cache serialization', () => {
  it('brings Money, Date and Map back as themselves, at any depth', () => {
    const cache = {
      clientState: {
        queries: [
          {
            state: {
              data: {
                balance: Money.ofMinor(-2_500, 'EUR'),
                occurredAt: new Date(2026, 9, 14),
                byCategory: new Map([['food', Money.ofMinor(43_500, 'EUR')]]),
                items: [{ amount: Money.ofMinor(1_001, 'EUR'), note: 'Luz' }],
              },
            },
          },
        ],
      },
    };

    const revived = deserializeCache<typeof cache>(serializeCache(cache));
    const data = revived.clientState.queries[0]!.state.data;

    expect(data.balance).toBeInstanceOf(Money);
    expect(data.balance.equals(Money.ofMinor(-2_500, 'EUR'))).toBe(true);
    expect(data.occurredAt).toEqual(new Date(2026, 9, 14));
    expect(data.byCategory.get('food')?.amountMinor).toBe(43_500);
    expect(data.items[0]?.amount).toBeInstanceOf(Money);
    expect(data.items[0]?.note).toBe('Luz');
  });

  it('leaves plain JSON untouched', () => {
    const plain = { a: 1, b: ['x', null], c: { d: true } };
    expect(deserializeCache(serializeCache(plain))).toEqual(plain);
  });
});

import { describe, expect, it } from 'vitest';

import { suggestTransfers, UnbalancedNetsError } from '../settle.ts';

const net = (memberId: string, netMinor: number) => ({ memberId, netMinor });

/** Applies the transfers and returns what is left for each member. */
function afterTransfers(
  nets: { memberId: string; netMinor: number }[],
  transfers: ReturnType<typeof suggestTransfers>,
) {
  const left = new Map(nets.map((n) => [n.memberId, n.netMinor]));
  for (const t of transfers) {
    left.set(t.fromMemberId, left.get(t.fromMemberId)! + t.amountMinor);
    left.set(t.toMemberId, left.get(t.toMemberId)! - t.amountMinor);
  }
  return [...left.values()];
}

describe('suggestTransfers', () => {
  it('two members: the debtor pays the creditor once', () => {
    expect(suggestTransfers([net('ana', 2_500), net('luis', -2_500)])).toEqual([
      { fromMemberId: 'luis', toMemberId: 'ana', amountMinor: 2_500 },
    ]);
  });

  it('nobody owes anything: no transfers', () => {
    expect(suggestTransfers([net('ana', 0), net('luis', 0)])).toEqual([]);
    expect(suggestTransfers([])).toEqual([]);
  });

  it('three members with odd cents settle to exactly zero in at most n − 1 transfers', () => {
    // 100,01 € paid by Ana, split 3 ways (33,34 / 33,34 / 33,33 with the leftover to the payer).
    const nets = [net('ana', 6_667), net('luis', -3_334), net('marta', -3_333)];

    const transfers = suggestTransfers(nets);

    expect(transfers).toEqual([
      { fromMemberId: 'luis', toMemberId: 'ana', amountMinor: 3_334 },
      { fromMemberId: 'marta', toMemberId: 'ana', amountMinor: 3_333 },
    ]);
    expect(afterTransfers(nets, transfers)).toEqual([0, 0, 0]);
  });

  it('the largest debtor pays the largest creditor first', () => {
    const nets = [net('a', 5_000), net('b', 1_000), net('c', -4_000), net('d', -2_000)];

    const transfers = suggestTransfers(nets);

    expect(transfers[0]).toEqual({ fromMemberId: 'c', toMemberId: 'a', amountMinor: 4_000 });
    expect(transfers.length).toBeLessThanOrEqual(nets.length - 1);
    expect(afterTransfers(nets, transfers)).toEqual([0, 0, 0, 0]);
  });

  it('is deterministic with ties (by member id)', () => {
    const nets = [net('z', 1_000), net('y', 1_000), net('x', -1_000), net('w', -1_000)];

    expect(suggestTransfers(nets)).toEqual([
      { fromMemberId: 'w', toMemberId: 'y', amountMinor: 1_000 },
      { fromMemberId: 'x', toMemberId: 'z', amountMinor: 1_000 },
    ]);
    expect(suggestTransfers([...nets].reverse())).toEqual(suggestTransfers(nets));
  });

  it('settles many random households to zero', () => {
    let seed = 7;
    const random = () => (seed = (seed * 48_271) % 2_147_483_647) / 2_147_483_647;
    for (let round = 0; round < 200; round += 1) {
      const size = 2 + Math.floor(random() * 5);
      const nets = Array.from({ length: size - 1 }, (_, i) =>
        net(`m${i}`, Math.floor(random() * 20_001) - 10_000),
      );
      nets.push(net(`m${size - 1}`, -nets.reduce((sum, n) => sum + n.netMinor, 0)));

      const transfers = suggestTransfers(nets);

      expect(afterTransfers(nets, transfers).every((left) => left === 0)).toBe(true);
      expect(transfers.length).toBeLessThanOrEqual(size - 1);
      expect(transfers.every((t) => t.amountMinor > 0)).toBe(true);
    }
  });

  it('rejects nets that do not add up to zero or are not whole cents', () => {
    expect(() => suggestTransfers([net('ana', 1), net('luis', 0)])).toThrow(UnbalancedNetsError);
    expect(() => suggestTransfers([net('ana', 0.5), net('luis', -0.5)])).toThrow(RangeError);
  });
});

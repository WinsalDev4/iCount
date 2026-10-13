import type { UserId } from '@/core/domain/Ids';

import { isValidShares } from '../SplitRule';

const ana = 'ana' as UserId;
const luis = 'luis' as UserId;

describe('isValidShares', () => {
  it('accepts integer shares that add up to 100 %', () => {
    expect(
      isValidShares([
        { memberId: ana, basisPoints: 6_000 },
        { memberId: luis, basisPoints: 4_000 },
      ]),
    ).toBe(true);
  });

  it.each([
    ['no shares', []],
    ['less than 100 %', [{ memberId: ana, basisPoints: 9_999 }]],
    [
      'a repeated member',
      [
        { memberId: ana, basisPoints: 5_000 },
        { memberId: ana, basisPoints: 5_000 },
      ],
    ],
    [
      'fractions of a basis point',
      [
        { memberId: ana, basisPoints: 3_333.5 },
        { memberId: luis, basisPoints: 6_666.5 },
      ],
    ],
    [
      'negative shares',
      [
        { memberId: ana, basisPoints: -1_000 },
        { memberId: luis, basisPoints: 11_000 },
      ],
    ],
  ])('rejects %s', (_, shares) => {
    expect(isValidShares(shares)).toBe(false);
  });
});

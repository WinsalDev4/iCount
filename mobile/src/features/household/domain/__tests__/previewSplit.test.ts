import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import { previewSplit, type PreviewMember } from '../previewSplit';
import type { SplitRule } from '../SplitRule';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const expense = eur(10_000);

const ana: PreviewMember = { id: 'ana', label: 'Ana', monthlyIncome: eur(200_000) };
const leo: PreviewMember = { id: 'leo', label: 'Leo', monthlyIncome: eur(185_000) };
const amounts = (rule: SplitRule, members: PreviewMember[], cat?: CategoryId) =>
  previewSplit(rule, members, expense, cat).shares.map((s) => s.amount.amountMinor);

describe('previewSplit', () => {
  describe('equal', () => {
    it('splits 50/50 between two', () => {
      expect(amounts({ kind: 'equal' }, [ana, leo])).toEqual([5_000, 5_000]);
    });

    it('keeps the cents exact between three', () => {
      const third = { id: 'eva', label: 'Eva', monthlyIncome: null };
      expect(amounts({ kind: 'equal' }, [ana, leo, third])).toEqual([3_334, 3_333, 3_333]);
    });

    it('reports each share in basis points and the labels', () => {
      const { shares, fallback } = previewSplit({ kind: 'equal' }, [ana, leo], expense);
      expect(shares.map((s) => s.label)).toEqual(['Ana', 'Leo']);
      expect(shares.map((s) => s.basisPoints)).toEqual([5_000, 5_000]);
      expect(fallback).toBeNull();
    });
  });

  describe('income-proportional', () => {
    it('splits in proportion to income', () => {
      // 2.000 € and 1.850 €: 51,95 % and 48,05 %.
      expect(amounts({ kind: 'income-proportional' }, [ana, leo])).toEqual([5_195, 4_805]);
    });

    it('falls back to equal, and says so, when someone has no income', () => {
      const unknown = { ...leo, monthlyIncome: null };
      const preview = previewSplit({ kind: 'income-proportional' }, [ana, unknown], expense);
      expect(preview.shares.map((s) => s.amount.amountMinor)).toEqual([5_000, 5_000]);
      expect(preview.fallback).toBe('income-missing');
    });

    it('falls back when all incomes are zero', () => {
      const zero = (m: PreviewMember) => ({ ...m, monthlyIncome: eur(0) });
      const preview = previewSplit(
        { kind: 'income-proportional' },
        [zero(ana), zero(leo)],
        expense,
      );
      expect(preview.fallback).toBe('income-missing');
    });
  });

  describe('custom', () => {
    const rule: SplitRule = {
      kind: 'custom',
      categories: [
        {
          categoryId: 'food' as CategoryId,
          shares: [
            { memberId: 'ana' as never, basisPoints: 7_000 },
            { memberId: 'leo' as never, basisPoints: 3_000 },
          ],
        },
      ],
    };

    it('uses the shares of the category', () => {
      expect(amounts(rule, [ana, leo], 'food' as CategoryId)).toEqual([7_000, 3_000]);
    });

    it('splits equally the categories that are not listed (and when there is no category)', () => {
      expect(amounts(rule, [ana, leo], 'leisure' as CategoryId)).toEqual([5_000, 5_000]);
      expect(amounts(rule, [ana, leo])).toEqual([5_000, 5_000]);
    });

    it('gives zero to a member that has no share', () => {
      const stranger = { id: 'eva', label: 'Eva', monthlyIncome: null };
      expect(amounts(rule, [ana, leo, stranger], 'food' as CategoryId)).toEqual([7_000, 3_000, 0]);
    });
  });

  it('keeps the currency of the expense', () => {
    const preview = previewSplit({ kind: 'equal' }, [ana, leo], Money.ofMinor(1_000, 'USD'));
    expect(preview.shares.every((s) => s.amount.currency === 'USD')).toBe(true);
  });

  it('previews a zero expense without dividing by zero', () => {
    const preview = previewSplit({ kind: 'equal' }, [ana, leo], eur(0));
    expect(preview.shares.map((s) => s.basisPoints)).toEqual([0, 0]);
  });

  it('shares always add up to the expense', () => {
    for (const cents of [1, 99, 10_000, 12_345, 99_999]) {
      const total = previewSplit({ kind: 'income-proportional' }, [ana, leo], eur(cents))
        .shares.map((s) => s.amount.amountMinor)
        .reduce((a, b) => a + b, 0);
      expect(total).toBe(cents);
    }
  });
});

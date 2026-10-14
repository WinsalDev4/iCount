import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';
import { InMemoryTransactionRepository } from '@/features/transactions/data/InMemoryTransactionRepository';
import type { Transaction } from '@/features/transactions/domain/Transaction';

import { InMemoryBudgetRepository } from '../InMemoryBudgetRepository';

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const OCT = { year: 2026, month: 10 };
const food = 'food' as CategoryId;
const leisure = 'leisure' as CategoryId;

let n = 0;
function expense(
  categoryId: CategoryId,
  cents: number,
  date: Date,
  extra: Partial<Transaction> = {},
): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    type: 'expense',
    amount: eur(cents),
    categoryId,
    description: '',
    occurredAt: date,
    householdId: 'h1',
    payerId: 'u' as never,
    shared: false,
    shares: [],
    ...extra,
  };
}

function make(transactions: Transaction[] = []) {
  const movements = new InMemoryTransactionRepository({ transactions });
  const budgets = new InMemoryBudgetRepository(movements, { seedDemoData: false });
  return { movements, budgets };
}

describe('InMemoryBudgetRepository', () => {
  describe('spent is derived from the movements', () => {
    it('counts only expenses of that category in that month', async () => {
      const { budgets } = make([
        expense(food, 4_000, new Date(2026, 9, 3)),
        expense(food, 1_000, new Date(2026, 9, 20)),
        expense(leisure, 9_999, new Date(2026, 9, 5)),
        expense(food, 7_777, new Date(2026, 8, 30)), // September
        expense(food, 5_555, new Date(2026, 9, 5), { householdId: 'other' }),
        expense(food, 3_333, new Date(2026, 9, 6), { type: 'income' }),
      ]);
      const created = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: OCT,
        limit: eur(30_000),
      });
      expect(created.spent.amountMinor).toBe(5_000);
      expect(created.remaining.amountMinor).toBe(25_000);
    });

    it('moves when a movement is added afterwards', async () => {
      const { budgets, movements } = make();
      await budgets.create({ householdId: 'h1', categoryId: food, month: OCT, limit: eur(10_000) });
      expect((await budgets.list('h1', OCT))[0]?.spent.amountMinor).toBe(0);
      await movements.create({
        householdId: 'h1',
        type: 'expense',
        amount: eur(2_500),
        categoryId: food,
        description: '',
        occurredAt: new Date(2026, 9, 14),
        shared: false,
      });
      const [budget] = await budgets.list('h1', OCT);
      expect(budget?.spent.amountMinor).toBe(2_500);
      expect(budget?.remaining.amountMinor).toBe(7_500);
    });

    it('a negative remainder means the budget was exceeded', async () => {
      const { budgets } = make([expense(food, 12_000, new Date(2026, 9, 3))]);
      const created = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: OCT,
        limit: eur(10_000),
      });
      expect(created.remaining.amountMinor).toBe(-2_000);
    });
  });

  describe('list / create', () => {
    it('lists by household and month', async () => {
      const { budgets } = make();
      await budgets.create({ householdId: 'h1', categoryId: food, month: OCT, limit: eur(100) });
      await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: { year: 2026, month: 11 },
        limit: eur(100),
      });
      await budgets.create({ householdId: 'h2', categoryId: food, month: OCT, limit: eur(100) });
      expect(await budgets.list('h1', OCT)).toHaveLength(1);
      expect(await budgets.list('h2', OCT)).toHaveLength(1);
      expect(await budgets.list('h3', OCT)).toHaveLength(0);
    });

    it('one budget per category and month', async () => {
      const { budgets } = make();
      await budgets.create({ householdId: 'h1', categoryId: food, month: OCT, limit: eur(100) });
      await expect(
        budgets.create({ householdId: 'h1', categoryId: food, month: OCT, limit: eur(200) }),
      ).rejects.toMatchObject({ reason: 'duplicate' });
      // Another month or category is fine.
      await expect(
        budgets.create({ householdId: 'h1', categoryId: leisure, month: OCT, limit: eur(200) }),
      ).resolves.toBeDefined();
    });

    it('refuses a limit of zero or less', async () => {
      const { budgets } = make();
      await expect(
        budgets.create({ householdId: 'h1', categoryId: food, month: OCT, limit: eur(0) }),
      ).rejects.toMatchObject({ reason: 'invalid' });
    });

    it('gives each budget its own id', async () => {
      const { budgets } = make();
      const a = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: OCT,
        limit: eur(1),
      });
      const b = await budgets.create({
        householdId: 'h1',
        categoryId: leisure,
        month: OCT,
        limit: eur(1),
      });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('demo data', () => {
    it('seeds a few budgets for the current month the first time a household is listed', async () => {
      const movements = new InMemoryTransactionRepository({ transactions: [] });
      const budgets = new InMemoryBudgetRepository(movements, { now: () => new Date(2026, 9, 14) });
      const list = await budgets.list('h1', OCT);
      expect(list.map((b) => b.categoryId).sort()).toEqual(['food', 'leisure', 'transport']);
      expect(await budgets.list('h1', OCT)).toHaveLength(3); // only once
      expect(await budgets.list('h1', { year: 2026, month: 9 })).toHaveLength(0);
    });
  });

  describe('updateLimit / delete', () => {
    it('changes the limit and keeps the spending', async () => {
      const { budgets } = make([expense(food, 4_000, new Date(2026, 9, 3))]);
      const created = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: OCT,
        limit: eur(10_000),
      });
      const updated = await budgets.updateLimit(created.id, eur(20_000));
      expect(updated.limit.amountMinor).toBe(20_000);
      expect(updated.spent.amountMinor).toBe(4_000);
      expect(updated.remaining.amountMinor).toBe(16_000);
    });

    it('refuses a non-positive limit and an unknown id', async () => {
      const { budgets } = make();
      const created = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: OCT,
        limit: eur(10_000),
      });
      await expect(budgets.updateLimit(created.id, eur(0))).rejects.toMatchObject({
        reason: 'invalid',
      });
      await expect(budgets.updateLimit('nope', eur(5))).rejects.toMatchObject({
        reason: 'not-found',
      });
    });

    it('deletes, and complains about an unknown id', async () => {
      const { budgets } = make();
      const created = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: OCT,
        limit: eur(10_000),
      });
      await budgets.delete(created.id);
      expect(await budgets.list('h1', OCT)).toEqual([]);
      await expect(budgets.delete(created.id)).rejects.toMatchObject({ reason: 'not-found' });
    });
  });

  describe('moveAmount', () => {
    async function twoBudgets(spentFood = 0) {
      const { budgets, movements } = make(
        spentFood ? [expense(food, spentFood, new Date(2026, 9, 3))] : [],
      );
      const a = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: OCT,
        limit: eur(30_000),
      });
      const b = await budgets.create({
        householdId: 'h1',
        categoryId: leisure,
        month: OCT,
        limit: eur(10_000),
      });
      return { budgets, movements, a, b };
    }

    it('takes limit from one and gives it to the other', async () => {
      const { budgets, a, b } = await twoBudgets();
      const [from, to] = await budgets.moveAmount(a.id, b.id, eur(5_000));
      expect(from.limit.amountMinor).toBe(25_000);
      expect(to.limit.amountMinor).toBe(15_000);
      const stored = await budgets.list('h1', OCT);
      expect(stored.find((x) => x.id === a.id)?.limit.amountMinor).toBe(25_000);
      expect(stored.find((x) => x.id === b.id)?.limit.amountMinor).toBe(15_000);
    });

    it('the total limit never changes', async () => {
      const { budgets, a, b } = await twoBudgets();
      await budgets.moveAmount(a.id, b.id, eur(12_345));
      const total = (await budgets.list('h1', OCT)).reduce(
        (sum, x) => sum + x.limit.amountMinor,
        0,
      );
      expect(total).toBe(40_000);
    });

    it('does not touch the spending', async () => {
      const { budgets, a, b } = await twoBudgets(8_000);
      const [from] = await budgets.moveAmount(a.id, b.id, eur(5_000));
      expect(from.spent.amountMinor).toBe(8_000);
      expect(from.remaining.amountMinor).toBe(17_000);
    });

    it('the source keeps at least what it already spent', async () => {
      const { budgets, a, b } = await twoBudgets(25_000);
      // Limit 300, spent 250: at most 50 can leave.
      await expect(budgets.moveAmount(a.id, b.id, eur(5_001))).rejects.toMatchObject({
        reason: 'insufficient-amount',
      });
      await expect(budgets.moveAmount(a.id, b.id, eur(5_000))).resolves.toBeDefined();
    });

    it('cannot empty the source budget', async () => {
      const { budgets, a, b } = await twoBudgets();
      await expect(budgets.moveAmount(a.id, b.id, eur(30_000))).rejects.toMatchObject({
        reason: 'insufficient-amount',
      });
    });

    it('rejects a zero amount, unknown ids and budgets of different months', async () => {
      const { budgets, a, b } = await twoBudgets();
      await expect(budgets.moveAmount(a.id, b.id, eur(0))).rejects.toMatchObject({
        reason: 'invalid',
      });
      await expect(budgets.moveAmount('nope', b.id, eur(1))).rejects.toMatchObject({
        reason: 'not-found',
      });
      const other = await budgets.create({
        householdId: 'h1',
        categoryId: food,
        month: { year: 2026, month: 11 },
        limit: eur(100),
      });
      await expect(budgets.moveAmount(a.id, other.id, eur(1))).rejects.toMatchObject({
        reason: 'invalid',
      });
    });
  });
});

import { BUILT_IN_CATEGORY_IDS } from '@/core/domain/Category';

import { BUILT_IN_CATEGORIES, InMemoryCategoryRepository } from '../InMemoryCategoryRepository';
import { ListCategories } from '../../domain/usecases/ListCategories';

describe('InMemoryCategoryRepository', () => {
  it('has every built-in category the domain knows, once, with a Spanish name', () => {
    expect(BUILT_IN_CATEGORIES.map((c) => c.id).sort()).toEqual([...BUILT_IN_CATEGORY_IDS].sort());
    expect(new Set(BUILT_IN_CATEGORIES.map((c) => c.name)).size).toBe(BUILT_IN_CATEGORIES.length);
    expect(BUILT_IN_CATEGORIES.every((c) => c.isDefault && c.name.length > 0)).toBe(true);
  });

  it('lists the built-ins for any household', async () => {
    const repository = new InMemoryCategoryRepository();
    expect((await repository.list('h1')).length).toBe(BUILT_IN_CATEGORIES.length);
  });

  it('creates custom categories per household, trimmed, after the built-ins', async () => {
    const repository = new InMemoryCategoryRepository();
    const created = await repository.create('h1', {
      name: '  Mascotas ',
      icon: 'paw',
      kind: 'expense',
    });
    expect(created).toMatchObject({ name: 'Mascotas', isDefault: false });
    const mine = await repository.list('h1');
    expect(mine.at(-1)?.id).toBe(created.id);
    expect((await repository.list('h2')).some((c) => c.id === created.id)).toBe(false);
  });

  it('gives each custom category its own id', async () => {
    const repository = new InMemoryCategoryRepository();
    const a = await repository.create('h1', { name: 'A', icon: 'x', kind: 'expense' });
    const b = await repository.create('h1', { name: 'B', icon: 'x', kind: 'expense' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('ListCategories', () => {
  const useCase = new ListCategories(new InMemoryCategoryRepository());

  it('returns everything without a filter', async () => {
    expect((await useCase.execute('h1')).length).toBe(BUILT_IN_CATEGORIES.length);
  });

  it('keeps expense and "both" categories for expenses', async () => {
    const ids = (await useCase.execute('h1', 'expense')).map((c) => c.id);
    expect(ids).toContain('food');
    expect(ids).toContain('other');
    expect(ids).not.toContain('salary');
  });

  it('keeps income and "both" categories for incomes', async () => {
    const ids = (await useCase.execute('h1', 'income')).map((c) => c.id);
    expect(ids).toEqual(['salary', 'other']);
  });
});

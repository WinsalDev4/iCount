import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { queryKeys } from '@/core/query/queryKeys';
import { categoriesFor, useCategories } from '@/features/categories/presentation/useCategories';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { monthOf } from '@/features/transactions/domain/monthGrid';
import { parseAmountInput } from '@/shared/format/parseAmountInput';

import type { Budget } from '../domain/Budget';
import { budgetErrorMessage } from './budgetMessages';

export interface FormCategory {
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
}

export type BudgetFormUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | {
      readonly status: 'ready';
      readonly mode: 'create' | 'edit';
      /** In create mode: categories that still have no budget this month. */
      readonly categories: readonly FormCategory[];
      readonly categoryName: string;
      readonly limitText: string;
      readonly limitError: string | null;
      readonly canSave: boolean;
      readonly confirmingDelete: boolean;
      readonly busy: boolean;
      readonly error: string | null;
    };

function limitToText(minor: number): string {
  const euros = Math.trunc(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(euros) : `${euros},${String(cents).padStart(2, '0')}`;
}

/**
 * ViewModel of "crear / editar presupuesto". With an `id` it edits (limit only, or deletes
 * behind a confirmation); without it, it creates one for the current month in a category that
 * does not have a budget yet.
 */
export function useBudgetFormViewModel(id: string | undefined) {
  const { listBudgets, createBudget, updateBudgetLimit, deleteBudget } = useDependencies().budgets;
  const queryClient = useQueryClient();
  const household = useActiveHousehold();
  const categories = useCategories(household?.id);
  const month = useMemo(() => monthOf(new Date()), []);
  const householdId = household?.id ?? '';

  const budgetsQuery = useQuery({
    queryKey: queryKeys.budgets.month(householdId, month),
    queryFn: () => listBudgets.execute(householdId, month),
    enabled: household !== undefined,
  });
  const existing: Budget | undefined = id ? budgetsQuery.data?.find((b) => b.id === id) : undefined;

  const [chosen, setChosen] = useState<string | null>(null);
  const [limitText, setLimitText] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In edit mode the field starts from the stored limit until the person types.
  const text = limitText ?? (existing ? limitToText(existing.limit.amountMinor) : '');
  const parsed = parseAmountInput(text, household?.currency ?? 'EUR');
  const limitOk = parsed.ok && parsed.amount.amountMinor > 0;

  const free = useMemo(() => {
    const taken = new Set((budgetsQuery.data ?? []).map((b) => b.categoryId as string));
    return categoriesFor(categories.data ?? [], 'expense').filter((c) => !taken.has(c.id));
  }, [budgetsQuery.data, categories.data]);
  const categoryId = chosen ?? free[0]?.id ?? null;

  const names = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id as string, c.name])),
    [categories.data],
  );

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all(householdId) }),
    [queryClient, householdId],
  );

  const create = useMutation({
    mutationFn: () => {
      if (!parsed.ok || categoryId === null) throw new Error('incomplete');
      return createBudget.execute({
        householdId,
        categoryId: categoryId as never,
        month,
        limit: parsed.amount,
      });
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: () => {
      if (!parsed.ok || !id) throw new Error('incomplete');
      return updateBudgetLimit.execute(id, parsed.amount);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteBudget.execute(id ?? ''),
    onSuccess: refresh,
  });

  const state = useMemo<BudgetFormUiState>(() => {
    if (!household || !budgetsQuery.data) return { status: 'loading' };
    if (id && !existing) return { status: 'not-found' };
    return {
      status: 'ready',
      mode: id ? 'edit' : 'create',
      categories: free.map((c) => ({ id: c.id, name: c.name, selected: c.id === categoryId })),
      categoryName: existing ? (names.get(existing.categoryId) ?? 'Sin categoría') : '',
      limitText: text,
      limitError: text !== '' && !limitOk ? 'Escribe un importe mayor que cero, p. ej. 250' : null,
      canSave:
        limitOk && (id ? true : categoryId !== null) && !create.isPending && !update.isPending,
      confirmingDelete,
      busy: create.isPending || update.isPending || remove.isPending,
      error,
    };
  }, [
    household,
    budgetsQuery.data,
    id,
    existing,
    free,
    categoryId,
    names,
    text,
    limitOk,
    create.isPending,
    update.isPending,
    remove.isPending,
    confirmingDelete,
    error,
  ]);

  function changeLimit(value: string) {
    setLimitText(value);
    setError(null);
  }

  /** Saves; resolves true when it worked (the screen then closes). */
  async function save(): Promise<boolean> {
    setError(null);
    try {
      await (id ? update.mutateAsync() : create.mutateAsync());
      return true;
    } catch (e) {
      setError(budgetErrorMessage(e));
      return false;
    }
  }

  const requestDelete = () => setConfirmingDelete(true);
  const cancelDelete = () => setConfirmingDelete(false);

  /** Deletes; resolves true when it worked (the screen then closes). */
  async function confirmDelete(): Promise<boolean> {
    setError(null);
    try {
      await remove.mutateAsync();
      return true;
    } catch (e) {
      setError(budgetErrorMessage(e));
      setConfirmingDelete(false);
      return false;
    }
  }

  return {
    state,
    selectCategory: setChosen,
    changeLimit,
    save,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}

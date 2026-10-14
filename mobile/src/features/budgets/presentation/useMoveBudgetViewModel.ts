import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';
import { useCategories } from '@/features/categories/presentation/useCategories';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { monthOf } from '@/features/transactions/domain/monthGrid';
import { parseAmountInput } from '@/shared/format/parseAmountInput';

import { budgetErrorMessage } from './budgetMessages';

export interface MoveTarget {
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
}

export type MoveBudgetUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'nothing-to-move' }
  | {
      readonly status: 'ready';
      readonly fromName: string;
      /** The most that can leave the source: its limit minus what it already spent. */
      readonly movable: string;
      readonly targets: readonly MoveTarget[];
      readonly amountText: string;
      readonly amountError: string | null;
      /** "Comida: 300,00 € → 250,00 €" lines, once the amount is valid. */
      readonly preview: readonly string[];
      readonly canMove: boolean;
      readonly busy: boolean;
      readonly error: string | null;
    };

/**
 * ViewModel of "mover importe entre presupuestos": takes part of the limit of one budget and
 * gives it to another of the same month. The source keeps at least what it already spent.
 */
export function useMoveBudgetViewModel(fromId: string | undefined) {
  const { listBudgets, moveBudgetAmount } = useDependencies().budgets;
  const queryClient = useQueryClient();
  const household = useActiveHousehold();
  const categories = useCategories(household?.id);
  const month = useMemo(() => monthOf(new Date()), []);
  const householdId = household?.id ?? '';

  const budgets = useQuery({
    queryKey: queryKeys.budgets.month(householdId, month),
    queryFn: () => listBudgets.execute(householdId, month),
    enabled: household !== undefined,
  });

  const [chosenTarget, setChosenTarget] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id as string, c.name])),
    [categories.data],
  );
  const from = budgets.data?.find((b) => b.id === fromId);
  const others = useMemo(
    () => (budgets.data ?? []).filter((b) => b.id !== fromId),
    [budgets.data, fromId],
  );
  const toId = others.find((b) => b.id === chosenTarget)?.id ?? others[0]?.id ?? null;
  const to = others.find((b) => b.id === toId);

  const currency = household?.currency ?? 'EUR';
  const parsed = parseAmountInput(amountText, currency);
  // The source keeps what it already spent, and at least one cent of limit.
  const movableMinor = from
    ? Math.max(0, from.limit.amountMinor - Math.max(from.spent.amountMinor, 1))
    : 0;
  const amountOk =
    parsed.ok && parsed.amount.amountMinor > 0 && parsed.amount.amountMinor <= movableMinor;

  const move = useMutation({
    mutationFn: () => {
      if (!parsed.ok || !fromId || !toId) throw new Error('incomplete');
      return moveBudgetAmount.execute(fromId, toId, parsed.amount);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all(householdId) }),
  });

  const state = useMemo<MoveBudgetUiState>(() => {
    if (!household || !budgets.data) return { status: 'loading' };
    if (!from) return { status: 'not-found' };
    if (others.length === 0 || movableMinor <= 0) return { status: 'nothing-to-move' };

    const nameOf = (id: string, categoryId: string) => names.get(categoryId) ?? id;
    const amount = parsed.ok ? parsed.amount : null;
    return {
      status: 'ready',
      fromName: nameOf(from.id, from.categoryId),
      movable: Money.ofMinor(movableMinor, currency).format(),
      targets: others.map((b) => ({
        id: b.id,
        name: nameOf(b.id, b.categoryId),
        selected: b.id === toId,
      })),
      amountText,
      amountError:
        amountText !== '' && !amountOk
          ? parsed.ok && parsed.amount.amountMinor > movableMinor
            ? `Como mucho puedes mover ${Money.ofMinor(movableMinor, currency).format()}`
            : 'Escribe un importe mayor que cero, p. ej. 25'
          : null,
      preview:
        amountOk && amount && to
          ? [
              `${nameOf(from.id, from.categoryId)}: ${from.limit.format()} → ${from.limit.minus(amount).format()}`,
              `${nameOf(to.id, to.categoryId)}: ${to.limit.format()} → ${to.limit.plus(amount).format()}`,
            ]
          : [],
      canMove: amountOk && toId !== null && !move.isPending,
      busy: move.isPending,
      error,
    };
  }, [
    household,
    budgets.data,
    from,
    others,
    movableMinor,
    names,
    parsed,
    currency,
    toId,
    to,
    amountText,
    amountOk,
    move.isPending,
    error,
  ]);

  const changeAmount = useCallback((value: string) => {
    setAmountText(value);
    setError(null);
  }, []);

  /** Moves the amount; resolves true when it worked (the screen then closes). */
  const submit = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      await move.mutateAsync();
      return true;
    } catch (e) {
      setError(budgetErrorMessage(e));
      return false;
    }
  }, [move]);

  return { state, selectTarget: setChosenTarget, changeAmount, submit };
}

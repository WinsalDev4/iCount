import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { queryKeys } from '@/core/query/queryKeys';
import { categoriesFor, useCategories } from '@/features/categories/presentation/useCategories';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { parseAmountInput } from '@/shared/format/parseAmountInput';

import { addDays, startOfDay } from '../../domain/calendar';
import type { CategoryId, Transaction } from '../../domain/Transaction';
import { TransactionError } from '../../domain/TransactionError';
import { MAX_DESCRIPTION_LENGTH } from '../../domain/usecases/CreateTransaction';
import { transactionErrorMessage } from '../add/transactionMessages';

export type DetailMode = 'view' | 'edit' | 'confirm-delete';

export interface CategoryChip {
  readonly id: CategoryId;
  readonly name: string;
  readonly selected: boolean;
}

export interface DetailEditState {
  readonly amountText: string;
  readonly amountError: string | null;
  readonly categories: readonly CategoryChip[];
  readonly description: string;
  /** "miércoles, 14 de octubre" */
  readonly dayLabel: string;
  readonly canGoNextDay: boolean;
  /** The "Compartido" switch only exists in a shared household with several members. */
  readonly canShare: boolean;
  readonly shared: boolean;
  readonly canSave: boolean;
}

export type DetailUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly mode: DetailMode;
      readonly type: 'income' | 'expense';
      /** "-12,50 €" / "+1.925,00 €" */
      readonly amount: string;
      readonly typeLabel: string;
      readonly categoryName: string;
      readonly dateLabel: string;
      readonly payerLabel: string | null;
      readonly shared: boolean;
      readonly description: string;
      /** Present while editing. */
      readonly edit: DetailEditState | null;
      readonly busy: boolean;
      readonly error: string | null;
    };

const dayFormat = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function amountToText(minor: number): string {
  const euros = Math.trunc(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(euros) : `${euros},${String(cents).padStart(2, '0')}`;
}

function labelOf(member: { displayName: string | null; email: string }): string {
  return member.displayName ?? member.email.split('@')[0] ?? member.email;
}

/**
 * ViewModel of the movement detail: read it, edit it (amount, category, note, day, shared) or
 * delete it behind an explicit confirmation. No optimism here: after a change the detail and the
 * lists are refreshed from the source of truth.
 */
export function useTransactionDetailViewModel(id: string | undefined) {
  const { getTransaction, updateTransaction, deleteTransaction } = useDependencies().transactions;
  const queryClient = useQueryClient();
  const household = useActiveHousehold();
  const categories = useCategories(household?.id);

  const [mode, setMode] = useState<DetailMode>('view');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [description, setDescription] = useState('');
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: queryKeys.transactions.detail(id ?? ''),
    queryFn: () => getTransaction.execute(id ?? ''),
    enabled: id !== undefined,
    retry: false,
  });
  const tx: Transaction | undefined = detail.data;
  const today = useMemo(() => startOfDay(new Date()), []);

  const refreshLists = useCallback(
    async (transaction: Transaction) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(transaction.householdId),
      });
    },
    [queryClient],
  );

  const save = useMutation({
    mutationFn: (changes: Parameters<typeof updateTransaction.execute>[1]) =>
      updateTransaction.execute(id ?? '', changes),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.transactions.detail(updated.id), updated);
      await refreshLists(updated);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteTransaction.execute(id ?? ''),
    onSuccess: async () => {
      if (!tx) return;
      queryClient.removeQueries({ queryKey: queryKeys.transactions.detail(tx.id) });
      await refreshLists(tx);
    },
  });

  const canShare = household?.kind === 'shared' && (household?.members.length ?? 0) > 1;
  const parsed = parseAmountInput(amountText, tx?.amount.currency ?? 'EUR');
  const amountOk = parsed.ok && parsed.amount.amountMinor > 0;
  const available = useMemo(
    () => (tx ? categoriesFor(categories.data ?? [], tx.type) : []),
    [categories.data, tx],
  );
  const categoryNames = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id as string, c.name])),
    [categories.data],
  );

  const state = useMemo<DetailUiState>(() => {
    if (id === undefined) return { status: 'not-found' };
    if (detail.isError) {
      return detail.error instanceof TransactionError && detail.error.reason === 'not-found'
        ? { status: 'not-found' }
        : { status: 'error', message: transactionErrorMessage(detail.error) };
    }
    if (!tx) return { status: 'loading' };

    const payer = household?.members.find((m) => m.userId === tx.payerId);
    const edit: DetailEditState | null =
      mode === 'edit'
        ? {
            amountText,
            amountError:
              amountText !== '' && !amountOk
                ? 'Escribe un importe mayor que cero, p. ej. 12,50'
                : null,
            categories: available.map((c) => ({
              id: c.id,
              name: c.name,
              selected: c.id === categoryId,
            })),
            description,
            dayLabel: dayFormat.format(day),
            canGoNextDay: day < today,
            canShare,
            shared: canShare && shared,
            canSave: amountOk && categoryId !== null && !save.isPending,
          }
        : null;

    return {
      status: 'ready',
      mode,
      type: tx.type,
      amount: `${tx.type === 'income' ? '+' : '-'}${tx.amount.format()}`,
      typeLabel: tx.type === 'income' ? 'Ingreso' : 'Gasto',
      categoryName: categoryNames.get(tx.categoryId) ?? 'Sin categoría',
      dateLabel: dayFormat.format(tx.occurredAt),
      payerLabel: payer ? labelOf(payer) : null,
      shared: tx.shared,
      description: tx.description,
      edit,
      busy: save.isPending || remove.isPending,
      error,
    };
  }, [
    id,
    detail.isError,
    detail.error,
    tx,
    household,
    mode,
    amountText,
    amountOk,
    available,
    categoryId,
    description,
    day,
    today,
    canShare,
    shared,
    save.isPending,
    remove.isPending,
    error,
    categoryNames,
  ]);

  const startEdit = useCallback(() => {
    if (!tx) return;
    setAmountText(amountToText(tx.amount.amountMinor));
    setCategoryId(tx.categoryId);
    setDescription(tx.description);
    setDay(startOfDay(tx.occurredAt));
    setShared(tx.shared);
    setError(null);
    setMode('edit');
  }, [tx]);

  const cancel = useCallback(() => {
    setError(null);
    setMode('view');
  }, []);

  const shiftDay = useCallback(
    (delta: 1 | -1) => {
      setDay((current) => {
        const next = addDays(current, delta);
        return next > today ? current : next; // never into the future
      });
    },
    [today],
  );

  const changeAmount = useCallback((text: string) => {
    setAmountText(text);
    setError(null);
  }, []);

  const changeDescription = useCallback((text: string) => {
    setDescription(text.slice(0, MAX_DESCRIPTION_LENGTH));
  }, []);

  /** Saves the edit; resolves true when it worked (the screen goes back to the read view). */
  const saveEdit = useCallback(async (): Promise<boolean> => {
    if (!tx || !parsed.ok || categoryId === null) return false;
    setError(null);
    try {
      await save.mutateAsync({
        amount: parsed.amount,
        categoryId,
        description,
        occurredAt: day,
        shared: canShare ? shared : tx.shared,
      });
      setMode('view');
      return true;
    } catch (e) {
      setError(transactionErrorMessage(e));
      return false;
    }
  }, [tx, parsed, categoryId, save, description, day, canShare, shared]);

  const requestDelete = useCallback(() => {
    setError(null);
    setMode('confirm-delete');
  }, []);

  /** Deletes for good; resolves true when it worked (the screen leaves). */
  const confirmDelete = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      await remove.mutateAsync();
      return true;
    } catch (e) {
      setError(transactionErrorMessage(e));
      setMode('view');
      return false;
    }
  }, [remove]);

  return {
    state,
    startEdit,
    cancel,
    changeAmount,
    selectCategory: setCategoryId,
    changeDescription,
    shiftDay,
    setShared,
    saveEdit,
    requestDelete,
    confirmDelete,
  };
}

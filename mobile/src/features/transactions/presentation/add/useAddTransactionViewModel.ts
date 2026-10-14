import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import type { UserId } from '@/core/domain/Ids';
import { optimisticMutation, prependToPage } from '@/core/query/optimistic';
import { queryKeys } from '@/core/query/queryKeys';
import { useSessionQuery } from '@/features/auth/presentation/session';
import { categoriesFor, useCategories } from '@/features/categories/presentation/useCategories';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { parseAmountInput } from '@/shared/format/parseAmountInput';
import { errorHaptic, successHaptic } from '@/shared/haptics';

import { applyKey, displayAmount, isPositiveAmountText, type KeypadKey } from '../../domain/keypad';
import type { CategoryId, NewTransaction, TransactionType } from '../../domain/Transaction';
import {
  MAX_DESCRIPTION_LENGTH,
  toOptimisticTransaction,
} from '../../domain/usecases/CreateTransaction';
import { transactionErrorMessage } from './transactionMessages';

export interface CategoryChip {
  readonly id: CategoryId;
  readonly name: string;
  readonly selected: boolean;
}

export interface PayerChip {
  readonly id: UserId;
  readonly label: string;
  readonly selected: boolean;
}

export type AddTransactionUiState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly type: TransactionType;
      /** "1.234,5": what the big number shows. */
      readonly amount: string;
      readonly currencySymbol: string;
      readonly categories: readonly CategoryChip[];
      readonly description: string;
      readonly dayOffset: 0 | -1;
      /** Payer chips, only when the household has several members. */
      readonly payers: readonly PayerChip[];
      /** "Compartido" switch, only in a shared household with someone else in it. */
      readonly canShare: boolean;
      readonly shared: boolean;
      readonly canSave: boolean;
      readonly saving: boolean;
      readonly error: string | null;
    };

function labelOf(member: { displayName: string | null; email: string }): string {
  return member.displayName ?? member.email.split('@')[0] ?? member.email;
}

/**
 * ViewModel of screen 05-A "teclado propio": type, amount (typed on our keypad), category,
 * payer and "shared". Saving is optimistic (ADR-0014): the movement appears at the top of the
 * lists immediately and is rolled back if the server refuses it.
 */
export function useAddTransactionViewModel() {
  const { createTransaction } = useDependencies().transactions;
  const queryClient = useQueryClient();
  const household = useActiveHousehold();
  const categoriesQuery = useCategories(household?.id);
  const session = useSessionQuery();
  const me = session.data?.user.id;

  const [type, setTypeState] = useState<TransactionType>('expense');
  const [text, setText] = useState('');
  const [chosenCategory, setChosenCategory] = useState<CategoryId | null>(null);
  const [description, setDescriptionState] = useState('');
  const [dayOffset, setDayOffset] = useState<0 | -1>(0);
  const [chosenPayer, setChosenPayer] = useState<UserId | null>(null);
  const [shared, setSharedState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const householdId = household?.id;
  const currency = household?.currency ?? 'EUR';

  const available = useMemo(
    () => categoriesFor(categoriesQuery.data ?? [], type),
    [categoriesQuery.data, type],
  );
  // The chosen category only counts while it fits the type (switching to income drops "Comida").
  const categoryId = available.find((c) => c.id === chosenCategory)?.id ?? available[0]?.id ?? null;

  const members = useMemo(() => household?.members ?? [], [household]);
  const canShare = household?.kind === 'shared' && members.length > 1;
  const payerId = members.find((m) => m.userId === chosenPayer)?.userId ?? me ?? members[0]?.userId;

  const parsed = parseAmountInput(text, currency);
  const amountOk = isPositiveAmountText(text) && parsed.ok;

  const mutation = useMutation(
    optimisticMutation<unknown, NewTransaction>({
      queryClient,
      mutationFn: (input) => createTransaction.send(input),
      updates: [
        {
          queryKey: queryKeys.transactions.lists(householdId ?? ''),
          update: (current, input) =>
            prependToPage(current, toOptimisticTransaction(input, me ?? ('me' as UserId))),
        },
      ],
      // A new expense also moves the bars of the budgets.
      invalidate: [
        queryKeys.transactions.all(householdId ?? ''),
        queryKeys.budgets.all(householdId ?? ''),
      ],
    }),
  );

  const state = useMemo<AddTransactionUiState>(() => {
    if (!household || categoriesQuery.isPending) return { status: 'loading' };
    return {
      status: 'ready',
      type,
      amount: displayAmount(text),
      currencySymbol: currency === 'EUR' ? '€' : currency,
      categories: available.map((c) => ({ id: c.id, name: c.name, selected: c.id === categoryId })),
      description,
      dayOffset,
      payers: canShare
        ? members.map((m) => ({ id: m.userId, label: labelOf(m), selected: m.userId === payerId }))
        : [],
      canShare,
      shared: canShare && shared,
      canSave: amountOk && categoryId !== null && !mutation.isPending,
      saving: mutation.isPending,
      error,
    };
  }, [
    household,
    categoriesQuery.isPending,
    type,
    text,
    currency,
    available,
    categoryId,
    description,
    dayOffset,
    canShare,
    members,
    payerId,
    shared,
    amountOk,
    mutation.isPending,
    error,
  ]);

  const pressKey = useCallback((key: KeypadKey) => {
    setText((current) => applyKey(current, key));
    setError(null);
  }, []);

  const setType = useCallback((next: TransactionType) => {
    setTypeState(next);
    setError(null);
  }, []);

  const selectCategory = useCallback((id: CategoryId) => setChosenCategory(id), []);
  const selectPayer = useCallback((id: UserId) => setChosenPayer(id), []);
  const setShared = useCallback((value: boolean) => setSharedState(value), []);
  const setDay = useCallback((offset: 0 | -1) => setDayOffset(offset), []);
  const setDescription = useCallback((value: string) => {
    setDescriptionState(value.slice(0, MAX_DESCRIPTION_LENGTH));
  }, []);

  /** Saves; resolves true when it was created (the View then closes the modal). */
  const submit = useCallback(async (): Promise<boolean> => {
    if (!householdId || categoryId === null || !parsed.ok) return false;
    setError(null);
    try {
      const day = new Date();
      day.setDate(day.getDate() + dayOffset);
      const input = createTransaction.prepare({
        householdId,
        type,
        amount: parsed.amount,
        categoryId,
        description,
        occurredAt: day,
        payerId: canShare ? payerId : undefined,
        shared: canShare && shared,
      });
      await mutation.mutateAsync(input);
      successHaptic();
      return true;
    } catch (e) {
      errorHaptic();
      setError(transactionErrorMessage(e));
      return false;
    }
  }, [
    householdId,
    categoryId,
    parsed,
    createTransaction,
    type,
    description,
    dayOffset,
    canShare,
    payerId,
    shared,
    mutation,
  ]);

  return {
    state,
    pressKey,
    setType,
    selectCategory,
    selectPayer,
    setShared,
    setDay,
    setDescription,
    submit,
  };
}

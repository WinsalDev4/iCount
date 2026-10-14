import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import type { CategoryId } from '@/core/domain/Category';
import { queryKeys } from '@/core/query/queryKeys';
import { categoriesFor, useCategories } from '@/features/categories/presentation/useCategories';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { parseAmountInput } from '@/shared/format/parseAmountInput';

import {
  type Frequency,
  FREQUENCY_LABELS,
  frequencyOf,
  ruleFor,
  ruleWithFrequency,
} from '../domain/recurrenceMath';
import type { RecurringKind } from '../domain/RecurringPayment';
import {
  DEFAULT_CATEGORY,
  formatDate,
  KIND_OPTIONS,
  recurringErrorMessage,
} from './recurringLabels';

export interface Chip<T> {
  readonly value: T;
  readonly label: string;
  readonly selected: boolean;
}

export type RecurringFormUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | {
      readonly status: 'ready';
      readonly mode: 'create' | 'edit';
      readonly name: string;
      readonly kinds: readonly Chip<RecurringKind>[];
      readonly amountText: string;
      readonly amountError: string | null;
      readonly frequencies: readonly Chip<Frequency>[];
      readonly categories: readonly Chip<string>[];
      /** "15 de octubre de 2026" (the first due date; fixed once created). */
      readonly firstDueLabel: string;
      /** The household has other members, so the payment can be shared with them. */
      readonly canShare: boolean;
      readonly shared: boolean;
      readonly canSave: boolean;
      readonly busy: boolean;
      readonly error: string | null;
      readonly confirmingDelete: boolean;
    };

function toText(minor: number): string {
  const euros = Math.trunc(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(euros) : `${euros},${String(cents).padStart(2, '0')}`;
}

/**
 * ViewModel of "alta / edición de pago recurrente". Creating asks for the first due date, whose
 * day (and month, for yearly payments) becomes the rule's anchor; editing keeps that anchor and
 * can change the name, kind, amount, category, periodicity and whether it is shared.
 */
export function useRecurringFormViewModel(id: string | undefined) {
  const {
    listRecurringPayments,
    createRecurringPayment,
    updateRecurringPayment,
    deleteRecurringPayment,
  } = useDependencies().recurring;
  const queryClient = useQueryClient();
  const household = useActiveHousehold();
  const householdId = household?.id ?? '';
  const categoriesQuery = useCategories(household?.id);
  const memberCount = household?.members.length ?? 0;

  const listQuery = useQuery({
    queryKey: queryKeys.recurring.all(householdId),
    queryFn: () => listRecurringPayments.execute(householdId),
    enabled: id !== undefined && household !== undefined,
  });
  const existing = id === undefined ? undefined : listQuery.data?.find((p) => p.id === id);

  const [name, setName] = useState<string | null>(null);
  const [kind, setKind] = useState<RecurringKind | null>(null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [shared, setShared] = useState<boolean | null>(null);
  const [firstDue, setFirstDue] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nameValue = name ?? existing?.name ?? '';
  const kindValue: RecurringKind = kind ?? existing?.kind ?? 'bill';
  const amountValue = amountText ?? (existing ? toText(existing.amount.amountMinor) : '');
  const frequencyValue: Frequency | null =
    frequency ?? (existing ? frequencyOf(existing.rule) : 'monthly');
  const sharedValue = shared ?? existing?.shared ?? false;
  const type: 'income' | 'expense' =
    existing?.type ?? (kindValue === 'income' ? 'income' : 'expense');

  const categoryChoices = useMemo(
    () => categoriesFor(categoriesQuery.data ?? [], type),
    [categoriesQuery.data, type],
  );
  const categoryValue =
    categoryId ??
    existing?.categoryId ??
    (categoryChoices.some((c) => c.id === DEFAULT_CATEGORY[kindValue])
      ? DEFAULT_CATEGORY[kindValue]
      : (categoryChoices[0]?.id ?? ''));

  const amount = parseAmountInput(amountValue, household?.currency ?? 'EUR');
  const amountOk = amount.ok && amount.amount.amountMinor > 0;
  const nameOk = nameValue.trim().length > 0;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all(householdId) });

  const create = useMutation({
    mutationFn: () => {
      if (!amount.ok || frequencyValue === null) throw new Error('incomplete');
      return createRecurringPayment.execute({
        householdId,
        name: nameValue,
        kind: kindValue,
        type,
        amount: amount.amount,
        categoryId: categoryValue as CategoryId,
        rule: ruleFor(frequencyValue, firstDue),
        startDate: firstDue,
        shared: sharedValue,
      });
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: () => {
      if (!id || !existing || !amount.ok) throw new Error('incomplete');
      const periodicityChanged =
        frequencyValue !== null && frequencyValue !== frequencyOf(existing.rule);
      return updateRecurringPayment.execute(id, {
        name: nameValue,
        kind: kindValue,
        amount: amount.amount,
        categoryId: categoryValue as CategoryId,
        shared: sharedValue,
        ...(periodicityChanged && {
          rule: ruleWithFrequency(existing.rule, frequencyValue, existing.startDate.getMonth() + 1),
        }),
      });
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteRecurringPayment.execute(id ?? ''),
    onSuccess: refresh,
  });

  const kindsOffered = KIND_OPTIONS.filter((o) =>
    existing ? (existing.type === 'income') === (o.value === 'income') : true,
  );

  const state = useMemo<RecurringFormUiState>(() => {
    if (household && categoriesQuery.isPending) return { status: 'loading' };
    if (id !== undefined && listQuery.isSuccess && !existing) return { status: 'not-found' };
    if (id !== undefined && !existing) return { status: 'loading' };
    return {
      status: 'ready',
      mode: id === undefined ? 'create' : 'edit',
      name: nameValue,
      kinds: kindsOffered.map((o) => ({ ...o, selected: o.value === kindValue })),
      amountText: amountValue,
      amountError:
        amountValue !== '' && !amountOk ? 'Escribe un importe mayor que cero, p. ej. 12,99' : null,
      frequencies: (Object.keys(FREQUENCY_LABELS) as Frequency[]).map((value) => ({
        value,
        label: FREQUENCY_LABELS[value],
        selected: value === frequencyValue,
      })),
      categories: categoryChoices.map((c) => ({
        value: c.id as string,
        label: c.name,
        selected: c.id === categoryValue,
      })),
      firstDueLabel: formatDate(existing ? existing.startDate : firstDue),
      canShare: memberCount > 1,
      shared: sharedValue,
      canSave:
        nameOk &&
        amountOk &&
        frequencyValue !== null &&
        categoryValue !== '' &&
        !create.isPending &&
        !update.isPending,
      busy: create.isPending || update.isPending || remove.isPending,
      error,
      confirmingDelete,
    };
  }, [
    id,
    household,
    categoriesQuery.isPending,
    listQuery.isSuccess,
    existing,
    nameValue,
    kindsOffered,
    kindValue,
    amountValue,
    amountOk,
    frequencyValue,
    categoryChoices,
    categoryValue,
    firstDue,
    memberCount,
    sharedValue,
    nameOk,
    create.isPending,
    update.isPending,
    remove.isPending,
    error,
    confirmingDelete,
  ]);

  /** Moves the first due date by whole months (the day is kept when it fits). */
  function shiftFirstDue(months: number) {
    setFirstDue((current) => {
      const target = new Date(current.getFullYear(), current.getMonth() + months, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      return new Date(
        target.getFullYear(),
        target.getMonth(),
        Math.min(current.getDate(), lastDay),
      );
    });
  }

  /** Moves the first due date by days (so the person can pick any day of the month). */
  function shiftFirstDueDays(days: number) {
    setFirstDue(
      (current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + days),
    );
  }

  /** Saves; resolves true when it worked (the screen then closes). */
  async function save(): Promise<boolean> {
    setError(null);
    try {
      await (id ? update.mutateAsync() : create.mutateAsync());
      return true;
    } catch (e) {
      setError(recurringErrorMessage(e));
      return false;
    }
  }

  async function confirmDelete(): Promise<boolean> {
    setError(null);
    try {
      await remove.mutateAsync();
      return true;
    } catch (e) {
      setError(recurringErrorMessage(e));
      setConfirmingDelete(false);
      return false;
    }
  }

  return {
    state,
    changeName: (value: string) => {
      setName(value);
      setError(null);
    },
    selectKind: (value: RecurringKind) => {
      setKind(value);
      // A new kind brings its usual category, unless the person already picked one.
      setCategoryId(null);
    },
    changeAmount: (value: string) => {
      setAmountText(value);
      setError(null);
    },
    selectFrequency: setFrequency,
    selectCategory: setCategoryId,
    setShared,
    shiftFirstDue,
    shiftFirstDueDays,
    save,
    requestDelete: () => setConfirmingDelete(true),
    cancelDelete: () => setConfirmingDelete(false),
    confirmDelete,
  };
}

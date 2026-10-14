import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { queryKeys } from '@/core/query/queryKeys';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { parseAmountInput } from '@/shared/format/parseAmountInput';

import type { DebtKind } from '../domain/Debt';
import { formatRate, parseRateInput } from '../domain/parseRateInput';
import { debtErrorMessage, formatDate, KIND_OPTIONS } from './debtLabels';

export interface KindChip {
  readonly value: DebtKind;
  readonly label: string;
  readonly selected: boolean;
}

export type DebtFormUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | {
      readonly status: 'ready';
      readonly mode: 'create' | 'edit';
      readonly name: string;
      readonly kinds: readonly KindChip[];
      readonly principalText: string;
      readonly principalError: string | null;
      readonly rateText: string;
      readonly rateError: string | null;
      readonly termText: string;
      readonly termError: string | null;
      /** Optional: left empty, the instalment is computed (French method). */
      readonly paymentText: string;
      readonly paymentError: string | null;
      /** "15 de octubre de 2025" */
      readonly startLabel: string;
      readonly canSave: boolean;
      readonly busy: boolean;
      readonly error: string | null;
    };

const monthsOf = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text) : Number.NaN);

function toText(minor: number): string {
  const euros = Math.trunc(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(euros) : `${euros},${String(cents).padStart(2, '0')}`;
}

/**
 * ViewModel of "alta / edición de deuda". Creating asks for principal, rate, term and the date of
 * the first instalment; editing changes name, kind, rate, term and instalment (the borrowed amount
 * and start date are history). The instalment is optional on creation.
 */
export function useDebtFormViewModel(id: string | undefined) {
  const { getDebt, createDebt, updateDebt } = useDependencies().debts;
  const queryClient = useQueryClient();
  const household = useActiveHousehold();
  const householdId = household?.id ?? '';
  const currency = household?.currency ?? 'EUR';

  const existingQuery = useQuery({
    queryKey: queryKeys.debts.detail(id ?? ''),
    queryFn: () => getDebt.execute(id ?? ''),
    enabled: id !== undefined,
    retry: false,
  });
  const existing = existingQuery.data;

  const [name, setName] = useState<string | null>(null);
  const [kind, setKind] = useState<DebtKind | null>(null);
  const [principalText, setPrincipalText] = useState('');
  const [rateText, setRateText] = useState<string | null>(null);
  const [termText, setTermText] = useState<string | null>(null);
  const [paymentText, setPaymentText] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [error, setError] = useState<string | null>(null);

  // In edit mode every field starts from the stored debt until the person types.
  const nameValue = name ?? existing?.name ?? '';
  const kindValue = kind ?? existing?.kind ?? 'other';
  const rateValue =
    rateText ?? (existing ? formatRate(existing.annualRateBps).replace(' %', '') : '');
  const termValue = termText ?? (existing ? String(existing.termMonths) : '');
  const paymentValue = paymentText ?? (existing ? toText(existing.monthlyPayment.amountMinor) : '');

  const principal = parseAmountInput(principalText, currency);
  const rate = parseRateInput(rateValue);
  const term = monthsOf(termValue);
  const payment = parseAmountInput(paymentValue, currency);
  const paymentGiven = paymentValue.trim() !== '';

  const principalOk = principal.ok && principal.amount.amountMinor > 0;
  const rateOk = rate.ok;
  const termOk = Number.isInteger(term) && term >= 1 && term <= 600;
  const paymentOk = !paymentGiven || (payment.ok && payment.amount.amountMinor > 0);
  const nameOk = nameValue.trim().length > 0;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.debts.all(householdId) });

  const create = useMutation({
    mutationFn: () => {
      if (!principal.ok || !rate.ok) throw new Error('incomplete');
      return createDebt.execute({
        householdId,
        name: nameValue,
        kind: kindValue,
        principal: principal.amount,
        annualRateBps: rate.bps,
        startDate,
        termMonths: term,
        ...(paymentGiven && payment.ok && { monthlyPayment: payment.amount }),
      });
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: () => {
      if (!id || !rate.ok) throw new Error('incomplete');
      return updateDebt.execute(id, {
        name: nameValue,
        kind: kindValue,
        annualRateBps: rate.bps,
        termMonths: term,
        ...(paymentGiven && payment.ok && { monthlyPayment: payment.amount }),
      });
    },
    onSuccess: async (debt) => {
      queryClient.setQueryData(queryKeys.debts.detail(debt.id), debt);
      await refresh();
    },
  });

  const state = useMemo<DebtFormUiState>(() => {
    if (id !== undefined && existingQuery.isError) return { status: 'not-found' };
    if (id !== undefined && !existing) return { status: 'loading' };
    const editing = id !== undefined;
    return {
      status: 'ready',
      mode: editing ? 'edit' : 'create',
      name: nameValue,
      kinds: KIND_OPTIONS.map((o) => ({ ...o, selected: o.value === kindValue })),
      principalText: editing ? toText(existing?.principal.amountMinor ?? 0) : principalText,
      principalError:
        !editing && principalText !== '' && !principalOk
          ? 'Escribe un importe mayor que cero, p. ej. 12000'
          : null,
      rateText: rateValue,
      rateError: rateValue !== '' && !rateOk ? 'Escribe un porcentaje, p. ej. 6,9' : null,
      termText: termValue,
      termError: termValue !== '' && !termOk ? 'Indica los meses (de 1 a 600)' : null,
      paymentText: paymentValue,
      paymentError:
        paymentGiven && !paymentOk ? 'Escribe una cuota mayor que cero o déjala vacía' : null,
      startLabel: formatDate(editing && existing ? existing.startDate : startDate),
      canSave:
        nameOk &&
        rateOk &&
        termOk &&
        paymentOk &&
        (editing || principalOk) &&
        !create.isPending &&
        !update.isPending,
      busy: create.isPending || update.isPending,
      error,
    };
  }, [
    id,
    existingQuery.isError,
    existing,
    nameValue,
    kindValue,
    principalText,
    principalOk,
    rateValue,
    rateOk,
    termValue,
    termOk,
    paymentValue,
    paymentGiven,
    paymentOk,
    nameOk,
    startDate,
    create.isPending,
    update.isPending,
    error,
  ]);

  function changeName(value: string) {
    setName(value);
    setError(null);
  }
  function changePrincipal(value: string) {
    setPrincipalText(value);
    setError(null);
  }
  function changeRate(value: string) {
    setRateText(value);
    setError(null);
  }
  function changeTerm(value: string) {
    setTermText(value);
    setError(null);
  }
  function changePayment(value: string) {
    setPaymentText(value);
    setError(null);
  }

  /** Moves the date of the first instalment by whole months (the day is kept when it fits). */
  function shiftStart(months: number) {
    setStartDate((current) => {
      const target = new Date(current.getFullYear(), current.getMonth() + months, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      return new Date(
        target.getFullYear(),
        target.getMonth(),
        Math.min(current.getDate(), lastDay),
      );
    });
  }

  /** Saves; resolves true when it worked (the screen then closes). */
  async function save(): Promise<boolean> {
    setError(null);
    try {
      await (id ? update.mutateAsync() : create.mutateAsync());
      return true;
    } catch (e) {
      setError(debtErrorMessage(e));
      return false;
    }
  }

  return {
    state,
    changeName,
    selectKind: setKind,
    changePrincipal,
    changeRate,
    changeTerm,
    changePayment,
    shiftStart,
    save,
  };
}

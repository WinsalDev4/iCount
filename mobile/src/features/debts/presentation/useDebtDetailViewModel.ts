import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';

import { DebtError } from '../domain/DebtError';
import { nextInstallmentDate, paidRatio, remainingInstallments } from '../domain/debtMath';
import { formatRate } from '../domain/parseRateInput';
import {
  debtErrorMessage,
  formatDate,
  formatMonthYear,
  formatMonths,
  KIND_LABELS,
} from './debtLabels';

/** The "pay extra" chips: nothing, +50 €, +100 €, +200 € a month. */
export const EXTRA_OPTIONS_MINOR = [0, 5_000, 10_000, 20_000] as const;

export interface ExtraChip {
  readonly minor: number;
  readonly label: string;
  readonly selected: boolean;
}

export interface SimulationView {
  /** "Terminas 10 meses antes" / "Terminarías igual". */
  readonly headline: string;
  readonly interestSaved: string;
  readonly newEndDate: string;
  readonly baselineEndDate: string;
  readonly monthsSaved: number;
}

export type DebtDetailUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly name: string;
      readonly kindLabel: string;
      readonly outstanding: string;
      readonly principal: string;
      readonly paidRatio: number;
      readonly paidPercent: number;
      readonly monthlyPayment: string;
      readonly rate: string;
      readonly endDate: string;
      readonly nextPayment: string | null;
      readonly remaining: string;
      readonly paidOff: boolean;
      readonly extraChips: readonly ExtraChip[];
      /** `null` for a paid-off debt or while no extra is picked. */
      readonly simulation: SimulationView | null;
      readonly simulationError: string | null;
      readonly confirmingDelete: boolean;
      readonly busy: boolean;
      readonly error: string | null;
    };

/**
 * ViewModel of the debt detail (screen 08-B "detalle + simulador"): the progress ring, the
 * instalment and end date, and the extra-payment simulator that runs on the device.
 */
export function useDebtDetailViewModel(id: string | undefined) {
  const { getDebt, deleteDebt, simulateExtraPayment } = useDependencies().debts;
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [extraMinor, setExtraMinor] = useState<number>(EXTRA_OPTIONS_MINOR[1]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.debts.detail(id ?? ''),
    queryFn: () => getDebt.execute(id ?? ''),
    enabled: id !== undefined,
    retry: false,
  });
  const debt = query.data;

  const remove = useMutation({
    mutationFn: () => deleteDebt.execute(id ?? ''),
    onSuccess: async () => {
      if (!debt) return;
      queryClient.removeQueries({ queryKey: queryKeys.debts.detail(debt.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.debts.all(debt.householdId) });
    },
  });

  const simulation = useMemo<{ view: SimulationView | null; error: string | null }>(() => {
    if (!debt || extraMinor === 0) return { view: null, error: null };
    try {
      const result = simulateExtraPayment.execute(
        debt,
        Money.ofMinor(extraMinor, debt.outstanding.currency),
        today,
      );
      if (!result) return { view: null, error: null };
      return {
        view: {
          headline:
            result.monthsSaved > 0
              ? `Terminas ${formatMonths(result.monthsSaved)} antes`
              : 'Terminarías en la misma fecha',
          interestSaved: result.interestSaved.format(),
          newEndDate: result.newPayoffDate ? formatMonthYear(result.newPayoffDate) : '—',
          baselineEndDate: result.baselinePayoffDate
            ? formatMonthYear(result.baselinePayoffDate)
            : '—',
          monthsSaved: result.monthsSaved,
        },
        error: null,
      };
    } catch (e) {
      return { view: null, error: debtErrorMessage(e) };
    }
  }, [debt, extraMinor, simulateExtraPayment, today]);

  const state = useMemo<DebtDetailUiState>(() => {
    if (id === undefined) return { status: 'not-found' };
    if (query.isError) {
      return query.error instanceof DebtError && query.error.reason === 'not-found'
        ? { status: 'not-found' }
        : { status: 'error', message: debtErrorMessage(query.error) };
    }
    if (!debt) return { status: 'loading' };

    const ratio = paidRatio(debt);
    const next = nextInstallmentDate(debt, today);
    const paidOff = debt.outstanding.amountMinor <= 0;
    const left = remainingInstallments(debt, today);
    return {
      status: 'ready',
      name: debt.name,
      kindLabel: KIND_LABELS[debt.kind],
      outstanding: debt.outstanding.format(),
      principal: debt.principal.format(),
      paidRatio: ratio,
      paidPercent: Math.floor(ratio * 100),
      monthlyPayment: debt.monthlyPayment.format(),
      rate: formatRate(debt.annualRateBps),
      endDate: formatMonthYear(debt.endDate),
      nextPayment: next && !paidOff ? formatDate(next) : null,
      remaining: paidOff
        ? 'Pagada'
        : `${left} ${left === 1 ? 'cuota' : 'cuotas'} (${formatMonths(left)})`,
      paidOff,
      extraChips: EXTRA_OPTIONS_MINOR.map((minor) => ({
        minor,
        label:
          minor === 0
            ? 'Sin extra'
            : `+${Money.ofMinor(minor, debt.outstanding.currency).format().replace(/,00\s/, ' ')}`,
        selected: minor === extraMinor,
      })),
      simulation: simulation.view,
      simulationError: simulation.error,
      confirmingDelete,
      busy: remove.isPending,
      error,
    };
  }, [
    id,
    query.isError,
    query.error,
    debt,
    today,
    extraMinor,
    simulation,
    confirmingDelete,
    remove.isPending,
    error,
  ]);

  const selectExtra = useCallback((minor: number) => setExtraMinor(minor), []);
  const requestDelete = () => setConfirmingDelete(true);
  const cancelDelete = () => setConfirmingDelete(false);

  /** Deletes; resolves true when it worked (the screen then closes). */
  async function confirmDelete(): Promise<boolean> {
    setError(null);
    try {
      await remove.mutateAsync();
      return true;
    } catch (e) {
      setError(debtErrorMessage(e));
      setConfirmingDelete(false);
      return false;
    }
  }

  return { state, selectExtra, requestDelete, cancelDelete, confirmDelete };
}

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { queryKeys } from '@/core/query/queryKeys';
import { useActiveHousehold } from '@/features/household/presentation/households';

import type { DebtKind } from '../domain/Debt';
import { nextInstallmentDate, paidRatio, summarizeDebts } from '../domain/debtMath';
import { formatRate } from '../domain/parseRateInput';
import { formatDate, KIND_LABELS } from './debtLabels';

export interface DebtRow {
  readonly id: string;
  readonly name: string;
  readonly kind: DebtKind;
  readonly kindLabel: string;
  readonly outstanding: string;
  readonly rate: string;
  /** 0..1 paid. */
  readonly paidRatio: number;
  readonly paidPercent: number;
  readonly paidOff: boolean;
  /** "Próxima cuota: 15 de noviembre de 2026" / "Pagada". */
  readonly nextPayment: string;
}

export type DebtsUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly totalOutstanding: string;
      readonly totalMonthly: string;
      readonly aliveCount: number;
      readonly rows: readonly DebtRow[];
    };

/** ViewModel of the debts list (screen 08): what is owed in total and one row per debt. */
export function useDebtsViewModel() {
  const { listDebts } = useDependencies().debts;
  const household = useActiveHousehold();
  const today = useMemo(() => new Date(), []);

  const query = useQuery({
    queryKey: queryKeys.debts.all(household?.id ?? ''),
    queryFn: () => listDebts.execute(household?.id ?? ''),
    enabled: household !== undefined,
  });

  const state = useMemo<DebtsUiState>(() => {
    if (!household) return { status: 'loading' };
    if (query.isError) return { status: 'error', message: 'No hemos podido cargar tus deudas.' };
    if (!query.data) return { status: 'loading' };

    const totals = summarizeDebts(query.data, household.currency);
    return {
      status: 'ready',
      totalOutstanding: totals.outstanding.format(),
      totalMonthly: totals.monthlyPayments.format(),
      aliveCount: totals.count,
      rows: query.data.map((debt) => {
        const ratio = paidRatio(debt);
        const next = nextInstallmentDate(debt, today);
        const paidOff = debt.outstanding.amountMinor <= 0;
        return {
          id: debt.id,
          name: debt.name,
          kind: debt.kind,
          kindLabel: KIND_LABELS[debt.kind],
          outstanding: debt.outstanding.format(),
          rate: formatRate(debt.annualRateBps),
          paidRatio: ratio,
          paidPercent: Math.floor(ratio * 100),
          paidOff,
          nextPayment: paidOff || !next ? 'Pagada' : `Próxima cuota: ${formatDate(next)}`,
        };
      }),
    };
  }, [household, query.isError, query.data, today]);

  return { state, refresh: query.refetch };
}

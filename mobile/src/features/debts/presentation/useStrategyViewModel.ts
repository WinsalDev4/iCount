import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';
import { useActiveHousehold } from '@/features/household/presentation/households';

import type { PayoffPlan } from '../domain/Debt';
import { debtErrorMessage, formatMonthYear, formatMonths } from './debtLabels';

export const STRATEGY_EXTRA_OPTIONS_MINOR = [0, 5_000, 10_000, 20_000] as const;

export interface StrategyCard {
  readonly key: 'avalanche' | 'snowball';
  readonly title: string;
  readonly description: string;
  readonly debtFreeDate: string;
  readonly totalInterest: string;
  /** Debts in the order the extra reaches them: "1. Tarjeta", "2. Coche". */
  readonly order: readonly string[];
}

export interface StrategyExtraChip {
  readonly minor: number;
  readonly label: string;
  readonly selected: boolean;
}

export type StrategyUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'nothing-owed' }
  | {
      readonly status: 'ready';
      readonly extraChips: readonly StrategyExtraChip[];
      readonly cards: readonly [StrategyCard, StrategyCard];
      /** The recommendation in one sentence. */
      readonly recommendation: string;
      /** The debt the snowball clears first (a quick win). */
      readonly firstWin: string | null;
    };

/** ViewModel of "avalancha vs bola de nieve" (screen 08-C), computed on the device. */
export function useStrategyViewModel() {
  const { listDebts, comparePayoffStrategies } = useDependencies().debts;
  const household = useActiveHousehold();
  const today = useMemo(() => new Date(), []);
  const [extraMinor, setExtraMinor] = useState<number>(STRATEGY_EXTRA_OPTIONS_MINOR[1]);

  const debts = useQuery({
    queryKey: queryKeys.debts.all(household?.id ?? ''),
    queryFn: () => listDebts.execute(household?.id ?? ''),
    enabled: household !== undefined,
  });

  const state = useMemo<StrategyUiState>(() => {
    if (!household) return { status: 'loading' };
    if (debts.isError) return { status: 'error', message: 'No hemos podido cargar tus deudas.' };
    if (!debts.data) return { status: 'loading' };

    const currency = household.currency;
    let comparison;
    try {
      comparison = comparePayoffStrategies.execute(
        debts.data,
        Money.ofMinor(extraMinor, currency),
        today,
      );
    } catch (e) {
      return { status: 'error', message: debtErrorMessage(e) };
    }
    if (!comparison) return { status: 'nothing-owed' };

    const names = new Map(debts.data.map((d) => [d.id, d.name]));
    const order = (plan: PayoffPlan) =>
      [...plan.debts]
        .sort((a, b) => a.order - b.order)
        .map((d) => `${d.order}. ${names.get(d.debtId) ?? 'Deuda'}`);
    const card = (
      key: StrategyCard['key'],
      title: string,
      description: string,
      plan: PayoffPlan,
    ): StrategyCard => ({
      key,
      title,
      description,
      debtFreeDate: formatMonthYear(plan.debtFreeDate),
      totalInterest: plan.totalInterest.format(),
      order: order(plan),
    });

    const saves = comparison.avalancheSavesInterest;
    return {
      status: 'ready',
      extraChips: STRATEGY_EXTRA_OPTIONS_MINOR.map((minor) => ({
        minor,
        label:
          minor === 0
            ? 'Sin extra'
            : `+${Money.ofMinor(minor, currency).format().replace(/,00\s/, ' ')}`,
        selected: minor === extraMinor,
      })),
      cards: [
        card(
          'avalanche',
          'Avalancha',
          'Primero la deuda con el tipo más alto: la que menos intereses cuesta.',
          comparison.avalanche,
        ),
        card(
          'snowball',
          'Bola de nieve',
          'Primero la deuda más pequeña: victorias rápidas que motivan.',
          comparison.snowball,
        ),
      ],
      recommendation:
        saves.amountMinor > 0
          ? `La avalancha te ahorra ${saves.format()} en intereses${
              comparison.avalancheSavesMonths > 0
                ? ` y termina ${formatMonths(comparison.avalancheSavesMonths)} antes`
                : ''
            }.`
          : 'Con tus deudas, las dos estrategias cuestan lo mismo: elige la que más te motive.',
      firstWin: comparison.snowballFirstWin
        ? (names.get(comparison.snowballFirstWin) ?? null)
        : null,
    };
  }, [household, debts.isError, debts.data, comparePayoffStrategies, extraMinor, today]);

  return { state, selectExtra: setExtraMinor };
}

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { householdKeys } from '@/features/activity/presentation/activityKeys';
import { useSessionQuery } from '@/features/auth/presentation/session';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { createNameOf } from '@/features/household/presentation/memberNames';

export type BalanceUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      /** "Debes 43,20 €" · "Te deben 43,20 €" · "Estás al día". */
      readonly headline: string;
      readonly tone: 'income' | 'expense' | 'neutral';
      /** "Tú debes 43,20 € a Ana" — one line per suggested transfer. */
      readonly lines: readonly string[];
      /** "Hay 2 gastos por revisar que aún no cuentan." */
      readonly pendingNote: string | null;
      readonly canSettle: boolean;
    };

/** ViewModel of the balance header of the Hogar tab (screen 09-A): who owes whom. */
export function useBalanceViewModel() {
  const { getBalance } = useDependencies().settlements;
  const household = useActiveHousehold();
  const householdId = household?.id ?? '';
  const meId = useSessionQuery().data?.user.id as string | undefined;

  const query = useQuery({
    queryKey: householdKeys.balance(householdId),
    queryFn: () => getBalance.execute(householdId),
    enabled: household !== undefined,
  });

  const state = useMemo<BalanceUiState>(() => {
    if (!household) return { status: 'loading' };
    if (query.isError) return { status: 'error', message: 'No hemos podido calcular el balance.' };
    if (!query.data) return { status: 'loading' };

    const nameOf = createNameOf(household.members, meId);
    const mine = query.data.members.find((b) => b.memberId === meId);
    const net = mine?.net.amountMinor ?? 0;
    const lines = query.data.suggestedTransfers.map((t) => {
      const amount = t.amount.format();
      if (t.from === meId) return `Tú debes ${amount} a ${nameOf(t.to)}`;
      if (t.to === meId) return `${nameOf(t.from)} te debe ${amount}`;
      return `${nameOf(t.from)} debe ${amount} a ${nameOf(t.to)}`;
    });
    const pending = query.data.pendingApprovalCount;
    return {
      status: 'ready',
      headline:
        net < 0
          ? `Debes ${mine?.net.format().replace('-', '')}`
          : net > 0
            ? `Te deben ${mine?.net.format()}`
            : 'Estás al día',
      tone: net < 0 ? 'expense' : net > 0 ? 'income' : 'neutral',
      lines,
      pendingNote:
        pending === 0
          ? null
          : `Hay ${pending} ${pending === 1 ? 'gasto por revisar que aún no cuenta' : 'gastos por revisar que aún no cuentan'}.`,
      canSettle: lines.length > 0,
    };
  }, [household, query.isError, query.data, meId]);

  return { state, refresh: query.refetch };
}

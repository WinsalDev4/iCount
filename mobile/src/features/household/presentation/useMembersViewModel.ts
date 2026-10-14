import { useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import type { HouseholdId } from '@/core/domain/Ids';
import { useSessionQuery } from '@/features/auth/presentation/session';

import { formatInviteCode } from '../domain/inviteCode';
import type { SplitRule } from '../domain/SplitRule';
import { householdErrorMessage } from './householdMessages';
import { useActiveHousehold } from './households';
import { memberLabel } from './memberNames';

export interface MemberRow {
  readonly id: string;
  readonly name: string;
  readonly isMe: boolean;
  readonly roleLabel: string;
  /** "Ingresos: 2.000,00 € al mes" or null when not declared. */
  readonly income: string | null;
}

export interface InviteBox {
  /** `ABCD-2345` */
  readonly code: string;
  readonly shareMessage: string;
}

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });

export function describeSplitRule(rule: SplitRule): string {
  switch (rule.kind) {
    case 'equal':
      return 'A partes iguales';
    case 'income-proportional':
      return 'Proporcional a los ingresos';
    case 'custom':
      return 'Personalizado por categoría';
  }
}

/** ViewModel of the members section: who is in the household, their incomes, the rule, an invite. */
export function useMembersViewModel() {
  const { createInvite } = useDependencies().household;
  const household = useActiveHousehold();
  const meId = useSessionQuery().data?.user.id as string | undefined;
  const [invite, setInvite] = useState<InviteBox | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members: readonly MemberRow[] = (household?.members ?? []).map((m) => ({
    id: m.userId,
    name: memberLabel(m),
    isMe: m.userId === meId,
    roleLabel: m.role === 'admin' ? 'Administrador' : 'Miembro',
    income: m.monthlyIncome ? `Ingresos: ${m.monthlyIncome.format()} al mes` : null,
  }));

  async function newInvite() {
    if (!household) return;
    setBusy(true);
    setError(null);
    try {
      const invitation = await createInvite.execute(household.id as HouseholdId);
      const code = formatInviteCode(invitation.code);
      setInvite({
        code,
        shareMessage: `Únete a «${household.name}» en iCount con este código: ${code}. Caduca el ${dateFormat.format(invitation.expiresAt)}.`,
      });
    } catch (e) {
      setError(householdErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return {
    state: {
      householdName: household?.name ?? '',
      isShared: members.length > 1,
      members,
      splitRule: household ? describeSplitRule(household.splitRule) : '',
      invite,
      busy,
      error,
    },
    newInvite,
  };
}

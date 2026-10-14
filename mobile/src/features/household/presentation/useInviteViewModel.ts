import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import type { HouseholdId } from '@/core/domain/Ids';

import type { Invitation } from '../domain/Household';
import { formatInviteCode } from '../domain/inviteCode';
import { householdErrorMessage } from './householdMessages';
import { useMyHouseholds } from './households';

export type InviteUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      /** `ABCD-2345`: easy to read aloud. */
      readonly code: string;
      readonly expiresOn: string;
      /** Text for the system share sheet. */
      readonly shareMessage: string;
    };

type Request =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly invitation: Invitation };

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });

/** ViewModel of the "invite" step: asks for a code once and offers to share or renew it. */
export function useInviteViewModel(householdId: HouseholdId | undefined) {
  const { createInvite } = useDependencies().household;
  const households = useMyHouseholds();
  const householdName = households.data?.find((h) => h.id === householdId)?.name ?? 'mi hogar';
  const [request, setRequest] = useState<Request>({ status: 'loading' });
  const requestedFor = useRef<HouseholdId | undefined | null>(null);

  const renew = useCallback(async () => {
    if (!householdId) {
      setRequest({ status: 'error', message: householdErrorMessage(null) });
      return;
    }
    setRequest({ status: 'loading' });
    try {
      setRequest({ status: 'ready', invitation: await createInvite.execute(householdId) });
    } catch (error) {
      setRequest({ status: 'error', message: householdErrorMessage(error) });
    }
  }, [householdId, createInvite]);

  useEffect(() => {
    if (requestedFor.current === householdId) return;
    requestedFor.current = householdId;
    void renew();
  }, [householdId, renew]);

  // Derived on every render, so the message uses the household name as soon as it is known.
  const state = useMemo<InviteUiState>(() => {
    if (request.status !== 'ready') return request;
    const code = formatInviteCode(request.invitation.code);
    const expiresOn = dateFormat.format(request.invitation.expiresAt);
    return {
      status: 'ready',
      code,
      expiresOn,
      shareMessage: `Únete a «${householdName}» en iCount con este código: ${code}. Caduca el ${expiresOn}.`,
    };
  }, [request, householdName]);

  return { state, householdName, renew };
}

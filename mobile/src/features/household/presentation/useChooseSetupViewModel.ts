import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import type { HouseholdId } from '@/core/domain/Ids';

import { setupStore } from '../data/setupStore';
import { isValidHouseholdName } from '../domain/householdName';
import { isValidInviteCode } from '../domain/inviteCode';
import { householdErrorMessage } from './householdMessages';
import { upsertHousehold } from './households';

export type SetupOption = 'personal' | 'shared' | 'join';

/** What the View should do after `submit()`. */
export type SetupOutcome =
  | { readonly kind: 'failed' }
  /** A shared household was created: continue with the invitation. */
  | { readonly kind: 'invite'; readonly householdId: HouseholdId }
  /** Personal household created or joined: the access gate moves the user to the app. */
  | { readonly kind: 'done' };

export interface ChooseSetupUiState {
  /** The expanded card; `null` while all are collapsed. */
  readonly selected: SetupOption | null;
  readonly personalName: string;
  readonly sharedName: string;
  readonly code: string;
  readonly working: boolean;
  readonly error: string | null;
  /** The primary button of the expanded card is enabled. */
  readonly canSubmit: boolean;
}

/**
 * ViewModel of screen 03-A "opciones desplegables": three cards (just me, shared, I have a
 * code) and the button of whichever is expanded.
 */
export function useChooseSetupViewModel() {
  const { createHousehold, joinHousehold } = useDependencies().household;
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SetupOption | null>(null);
  const [personalName, setPersonalName] = useState('Mis finanzas');
  const [sharedName, setSharedName] = useState('');
  const [code, setCodeState] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const select = useCallback((option: SetupOption | null) => {
    setSelected(option);
    setError(null);
  }, []);

  const setName = useCallback((option: 'personal' | 'shared', value: string) => {
    (option === 'personal' ? setPersonalName : setSharedName)(value);
    setError(null);
  }, []);

  const setCode = useCallback((value: string) => {
    setCodeState(value);
    setError(null);
  }, []);

  const canSubmit =
    !working &&
    ((selected === 'personal' && isValidHouseholdName(personalName)) ||
      (selected === 'shared' && isValidHouseholdName(sharedName)) ||
      (selected === 'join' && isValidInviteCode(code)));

  const submit = useCallback(async (): Promise<SetupOutcome> => {
    if (!canSubmit || selected === null) return { kind: 'failed' };
    setWorking(true);
    setError(null);
    try {
      if (selected === 'join') {
        upsertHousehold(queryClient, await joinHousehold.execute(code));
        return { kind: 'done' };
      }
      const kind = selected === 'personal' ? 'personal' : 'shared';
      const household = await createHousehold.execute({
        name: kind === 'personal' ? personalName : sharedName,
        kind,
      });
      if (kind === 'shared') {
        // Before the cache learns about the household: the gate must not let the user out yet.
        setupStore.getState().begin(household.id);
        upsertHousehold(queryClient, household);
        return { kind: 'invite', householdId: household.id };
      }
      upsertHousehold(queryClient, household);
      return { kind: 'done' };
    } catch (e) {
      setError(householdErrorMessage(e));
      return { kind: 'failed' };
    } finally {
      setWorking(false);
    }
  }, [
    canSubmit,
    selected,
    code,
    personalName,
    sharedName,
    joinHousehold,
    createHousehold,
    queryClient,
  ]);

  const state: ChooseSetupUiState = {
    selected,
    personalName,
    sharedName,
    code,
    working,
    error,
    canSubmit,
  };
  return { state, select, setName, setCode, submit };
}

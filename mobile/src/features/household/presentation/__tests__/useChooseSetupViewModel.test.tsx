import { act, renderHook } from '@testing-library/react-native';

import { queryKeys } from '@/core/query/queryKeys';

import { setupStore } from '../../data/setupStore';
import type { Household } from '../../domain/Household';
import { createHouseholdTestKit } from '../../testing/householdTestKit';
import { useChooseSetupViewModel } from '../useChooseSetupViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => setupStore.setState({ pendingHouseholdId: null }));

async function setup() {
  const kit = createHouseholdTestKit();
  const hook = await renderHook(() => useChooseSetupViewModel(), { wrapper: kit.Wrapper });
  return { ...kit, hook };
}

const cached = (kit: Awaited<ReturnType<typeof setup>>) =>
  kit.queryClient.getQueryData<readonly Household[]>(queryKeys.households.mine());

describe('useChooseSetupViewModel', () => {
  it('starts collapsed, with a friendly default name for a personal household', async () => {
    const { hook } = await setup();
    expect(hook.result.current.state).toMatchObject({
      selected: null,
      personalName: 'Mis finanzas',
      sharedName: '',
      code: '',
      canSubmit: false,
      error: null,
    });
  });

  it('enables the button of the expanded card only with valid input', async () => {
    const { hook } = await setup();
    const { result } = hook;

    await act(async () => result.current.select('shared'));
    expect(result.current.state.canSubmit).toBe(false); // empty name
    await act(async () => result.current.setName('shared', 'Casa Ana & Leo'));
    expect(result.current.state.canSubmit).toBe(true);

    await act(async () => result.current.select('join'));
    expect(result.current.state.canSubmit).toBe(false);
    await act(async () => result.current.setCode('abcd-23'));
    expect(result.current.state.canSubmit).toBe(false);
    await act(async () => result.current.setCode('abcd-2345'));
    expect(result.current.state.canSubmit).toBe(true);

    await act(async () => result.current.select('personal'));
    expect(result.current.state.canSubmit).toBe(true); // default name
    await act(async () => result.current.setName('personal', '   '));
    expect(result.current.state.canSubmit).toBe(false);
  });

  it('does nothing when nothing is expanded', async () => {
    const { hook, repository } = await setup();
    const create = jest.spyOn(repository, 'create');
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.submit();
    });
    expect(outcome).toEqual({ kind: 'failed' });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a personal household and caches it; the setup is not kept open', async () => {
    const kit = await setup();
    const { result } = kit.hook;
    await act(async () => result.current.select('personal'));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.submit();
    });
    expect(outcome).toEqual({ kind: 'done' });
    expect(cached(kit)).toHaveLength(1);
    expect(cached(kit)?.[0]).toMatchObject({ name: 'Mis finanzas', kind: 'personal' });
    expect(setupStore.getState().pendingHouseholdId).toBeNull();
  });

  it('creates a shared household, keeps the setup open and asks for the invitation', async () => {
    const kit = await setup();
    const { result } = kit.hook;
    await act(async () => result.current.select('shared'));
    await act(async () => result.current.setName('shared', 'Casa Ana & Leo'));

    let outcome: { kind: string; householdId?: string } = { kind: 'failed' };
    await act(async () => {
      outcome = await result.current.submit();
    });
    expect(outcome.kind).toBe('invite');
    expect(outcome.householdId).toBe(cached(kit)?.[0]?.id);
    expect(setupStore.getState().pendingHouseholdId).toBe(outcome.householdId);
    expect(cached(kit)?.[0]).toMatchObject({ name: 'Casa Ana & Leo', kind: 'shared' });
  });

  it('joins with a code (typed in any format)', async () => {
    const kit = await setup();
    const { result } = kit.hook;
    await act(async () => result.current.select('join'));
    await act(async () => result.current.setCode('wxyz-6789'));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.submit();
    });
    expect(outcome).toEqual({ kind: 'done' });
    expect(cached(kit)?.[0]).toMatchObject({ name: 'Casa Ana & Leo', kind: 'shared' });
  });

  it.each([
    ['EXPIRED1', 'caducado'],
    ['UNKNOWN1', 'no es válido'],
  ])('shows why joining with %s failed', async (code, fragment) => {
    const kit = await setup();
    const { result } = kit.hook;
    await act(async () => result.current.select('join'));
    await act(async () => result.current.setCode(code));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.submit();
    });
    expect(outcome).toEqual({ kind: 'failed' });
    expect(result.current.state.error).toContain(fragment);
    expect(cached(kit)).toBeUndefined();
    expect(result.current.state.working).toBe(false);
  });

  it('clears the error as soon as the person edits or switches card', async () => {
    const kit = await setup();
    const { result } = kit.hook;
    await act(async () => result.current.select('join'));
    await act(async () => result.current.setCode('EXPIRED1'));
    await act(async () => void (await result.current.submit()));
    expect(result.current.state.error).not.toBeNull();

    await act(async () => result.current.setCode('EXPIRED2'));
    expect(result.current.state.error).toBeNull();

    await act(async () => void (await result.current.submit()));
    await act(async () => result.current.select('personal'));
    expect(result.current.state.error).toBeNull();
  });

  it('shows a generic message for unexpected failures', async () => {
    const kit = await setup();
    jest.spyOn(kit.repository, 'create').mockRejectedValue(new Error('boom: 10.0.2.2'));
    const { result } = kit.hook;
    await act(async () => result.current.select('personal'));
    await act(async () => void (await result.current.submit()));
    expect(result.current.state.error).toBe('Algo ha salido mal. Inténtalo de nuevo.');
    expect(setupStore.getState().pendingHouseholdId).toBeNull();
  });
});

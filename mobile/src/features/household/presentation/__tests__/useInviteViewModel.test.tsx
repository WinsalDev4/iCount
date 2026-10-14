import { act, renderHook } from '@testing-library/react-native';

import type { HouseholdId } from '@/core/domain/Ids';
import { queryKeys } from '@/core/query/queryKeys';

import { HouseholdError } from '../../domain/HouseholdError';
import { createHouseholdTestKit } from '../../testing/householdTestKit';
import { upsertHousehold } from '../households';
import { useInviteViewModel } from '../useInviteViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

const NOW = new Date('2026-10-14T10:00:00Z');

async function sharedHousehold() {
  const kit = createHouseholdTestKit({ memory: { now: () => NOW } });
  const household = await kit.repository.create({
    name: 'Casa Ana & Leo',
    kind: 'shared',
    currency: 'EUR',
  });
  upsertHousehold(kit.queryClient, household);
  kit.queryClient.setQueryData(queryKeys.households.mine(), [household]);
  return { ...kit, household };
}

describe('useInviteViewModel', () => {
  it('asks for one invitation and shows the code in two halves', async () => {
    const kit = await sharedHousehold();
    const create = jest.spyOn(kit.repository, 'createInvite');
    const { result } = await renderHook(() => useInviteViewModel(kit.household.id), {
      wrapper: kit.Wrapper,
    });
    await act(async () => {});

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({ status: 'ready', code: 'ABCD-2345' });
  });

  it('builds a share message with the household name and the expiry date', async () => {
    const kit = await sharedHousehold();
    const { result } = await renderHook(() => useInviteViewModel(kit.household.id), {
      wrapper: kit.Wrapper,
    });
    await act(async () => {});

    const { state } = result.current;
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.shareMessage).toContain('«Casa Ana & Leo»');
    expect(state.shareMessage).toContain('ABCD-2345');
    expect(state.shareMessage).toContain(state.expiresOn);
    expect(state.expiresOn).toContain('16'); // 48 h after the 14th
  });

  it('does not ask again on re-render, but renew() creates a new code', async () => {
    const kit = await sharedHousehold();
    const create = jest.spyOn(kit.repository, 'createInvite');
    const { result, rerender } = await renderHook(() => useInviteViewModel(kit.household.id), {
      wrapper: kit.Wrapper,
    });
    await act(async () => {});
    await rerender(undefined);
    expect(create).toHaveBeenCalledTimes(1);

    await act(async () => result.current.renew());
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('shows the reason when the invitation cannot be created, and can retry', async () => {
    const kit = await sharedHousehold();
    const create = jest
      .spyOn(kit.repository, 'createInvite')
      .mockRejectedValueOnce(new HouseholdError('network'));
    const { result } = await renderHook(() => useInviteViewModel(kit.household.id), {
      wrapper: kit.Wrapper,
    });
    await act(async () => {});
    expect(result.current.state).toMatchObject({
      status: 'error',
      message: expect.stringContaining('conexión'),
    });

    await act(async () => result.current.renew());
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe('ready');
  });

  it('fails clearly without a household id (a broken deep link)', async () => {
    const kit = createHouseholdTestKit();
    const { result } = await renderHook(() => useInviteViewModel(undefined), {
      wrapper: kit.Wrapper,
    });
    await act(async () => {});
    expect(result.current.state.status).toBe('error');
  });

  it('reports an unknown household', async () => {
    const kit = createHouseholdTestKit();
    const { result } = await renderHook(() => useInviteViewModel('nope' as HouseholdId), {
      wrapper: kit.Wrapper,
    });
    await act(async () => {});
    expect(result.current.state).toMatchObject({
      status: 'error',
      message: expect.stringContaining('hogar'),
    });
  });
});

import { act, renderHook } from '@testing-library/react-native';

import { accessStore } from '../../data/accessStore';
import { createAuthTestKit, fakeBiometrics } from '../../testing/authTestKit';
import { endSession, sessionQueryKey, startSession } from '../session';
import { useAccountViewModel } from '../useAccountViewModel';
import { useLockViewModel } from '../useLockViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => accessStore.setState({ unlocked: false }));

describe('useLockViewModel', () => {
  it('unlocks the app when the check passes', async () => {
    const biometrics = fakeBiometrics({ passes: true });
    const { Wrapper } = createAuthTestKit({ biometrics });
    const { result } = await renderHook(() => useLockViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.unlock());

    expect(biometrics.authenticate).toHaveBeenCalledWith('Desbloquea iCount');
    expect(accessStore.getState().unlocked).toBe(true);
    expect(result.current.state.status).toBe('idle');
  });

  it('stays locked and offers a retry when the check fails', async () => {
    const { Wrapper } = createAuthTestKit({ biometrics: fakeBiometrics({ passes: false }) });
    const { result } = await renderHook(() => useLockViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.unlock());
    expect(accessStore.getState().unlocked).toBe(false);
    expect(result.current.state.status).toBe('failed');
  });

  it('treats a sensor error as a failed attempt', async () => {
    const biometrics = fakeBiometrics();
    biometrics.authenticate.mockRejectedValue(new Error('too many attempts'));
    const { Wrapper } = createAuthTestKit({ biometrics });
    const { result } = await renderHook(() => useLockViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.unlock());
    expect(result.current.state.status).toBe('failed');
  });

  it('can sign out when biometrics stop working, and forgets the session', async () => {
    const { Wrapper, queryClient, repository } = createAuthTestKit();
    const signOut = jest.spyOn(repository, 'signOut');
    await startSession(queryClient, {
      user: { id: 'u' as never, email: 'a@b.co', displayName: null },
    });
    accessStore.setState({ unlocked: false });

    const { result } = await renderHook(() => useLockViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.signOut());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(sessionQueryKey)).toBeNull();
  });
});

describe('useAccountViewModel', () => {
  it('shows who is signed in', async () => {
    const { Wrapper, queryClient } = createAuthTestKit();
    queryClient.setQueryData(sessionQueryKey, {
      user: { id: 'u', email: 'ana@casa.app', displayName: null },
    });
    const { result } = await renderHook(() => useAccountViewModel(), { wrapper: Wrapper });
    expect(result.current.state).toEqual({ email: 'ana@casa.app', signingOut: false });
  });

  it('signs out: revokes, clears the cache and locks', async () => {
    const { Wrapper, queryClient, repository } = createAuthTestKit();
    const signOut = jest.spyOn(repository, 'signOut');
    queryClient.setQueryData(sessionQueryKey, {
      user: { id: 'u', email: 'ana@casa.app', displayName: null },
    });
    queryClient.setQueryData(['transactions', 'h1'], [1, 2, 3]);
    accessStore.setState({ unlocked: true });

    const { result } = await renderHook(() => useAccountViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.signOut());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(sessionQueryKey)).toBeNull();
    expect(queryClient.getQueryData(['transactions', 'h1'])).toBeUndefined();
    expect(accessStore.getState().unlocked).toBe(false);
  });

  it('forgets the session on this device even if the server cannot be reached', async () => {
    const { Wrapper, queryClient, repository } = createAuthTestKit();
    jest.spyOn(repository, 'signOut').mockRejectedValue(new Error('offline'));
    queryClient.setQueryData(sessionQueryKey, {
      user: { id: 'u', email: 'ana@casa.app', displayName: null },
    });
    const { result } = await renderHook(() => useAccountViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.signOut());
    expect(queryClient.getQueryData(sessionQueryKey)).toBeNull();
    expect(result.current.state.signingOut).toBe(false);
  });
});

describe('session helpers', () => {
  it('endSession empties every cached query and puts null as the session', async () => {
    const { queryClient } = createAuthTestKit();
    queryClient.setQueryData(['budgets', 'h1'], ['x']);
    endSession(queryClient);
    expect(queryClient.getQueryData(['budgets', 'h1'])).toBeUndefined();
    expect(queryClient.getQueryData(sessionQueryKey)).toBeNull();
  });
});

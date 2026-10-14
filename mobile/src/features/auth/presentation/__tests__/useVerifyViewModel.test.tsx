import { act, renderHook } from '@testing-library/react-native';

import { accessStore } from '../../data/accessStore';
import { AuthError } from '../../domain/AuthError';
import { createAuthTestKit } from '../../testing/authTestKit';
import { sessionQueryKey } from '../session';
import { useVerifyViewModel } from '../useVerifyViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => accessStore.setState({ unlocked: false }));

describe('useVerifyViewModel', () => {
  it('verifies the token, stores the session and unlocks (a fresh sign-in is proof enough)', async () => {
    const { Wrapper, queryClient, repository } = createAuthTestKit();
    const verify = jest.spyOn(repository, 'verifyMagicLink');
    await renderHook(() => useVerifyViewModel('tok-1'), { wrapper: Wrapper });
    await act(async () => {});

    expect(verify).toHaveBeenCalledWith('tok-1');
    expect(queryClient.getQueryData(sessionQueryKey)).toMatchObject({
      user: { email: expect.any(String) },
    });
    expect(accessStore.getState().unlocked).toBe(true);
  });

  it('starts in "verifying" and has no success state: the router moves on by itself', async () => {
    const { Wrapper } = createAuthTestKit();
    const { result } = await renderHook(() => useVerifyViewModel('tok-1'), { wrapper: Wrapper });
    expect(result.current.state).toEqual({ status: 'verifying' });
    await act(async () => {});
    expect(result.current.state).toEqual({ status: 'verifying' });
  });

  it('shows the reason when the link is no longer valid', async () => {
    const { Wrapper, repository, queryClient } = createAuthTestKit();
    jest
      .spyOn(repository, 'verifyMagicLink')
      .mockRejectedValue(new AuthError('invalid-or-expired-link'));
    const { result } = await renderHook(() => useVerifyViewModel('old'), { wrapper: Wrapper });
    await act(async () => {});

    expect(result.current.state).toMatchObject({
      status: 'error',
      message: expect.stringContaining('enlace'),
    });
    expect(queryClient.getQueryData(sessionQueryKey)).toBeUndefined();
    expect(accessStore.getState().unlocked).toBe(false);
  });

  it('a link without token fails without calling the repository', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    const verify = jest.spyOn(repository, 'verifyMagicLink');
    const { result } = await renderHook(() => useVerifyViewModel(undefined), {
      wrapper: Wrapper,
    });
    await act(async () => {});
    expect(result.current.state.status).toBe('error');
    expect(verify).not.toHaveBeenCalled();
  });

  it('never spends a single-use token twice, even if the screen re-renders', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    const verify = jest.spyOn(repository, 'verifyMagicLink');
    const { rerender } = await renderHook(() => useVerifyViewModel('tok-1'), { wrapper: Wrapper });
    await act(async () => {});
    await rerender(undefined);
    await act(async () => {});
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('does not let a stale "signed out" read overwrite the new session', async () => {
    const { Wrapper, queryClient } = createAuthTestKit();
    // A slow getSession() read is still in flight when the link is verified.
    let finishRead: (value: null) => void = () => undefined;
    queryClient
      .fetchQuery({
        queryKey: sessionQueryKey,
        queryFn: () => new Promise<null>((resolve) => (finishRead = resolve)),
      })
      .catch(() => undefined); // cancelled on purpose

    await renderHook(() => useVerifyViewModel('tok-1'), { wrapper: Wrapper });
    await act(async () => {});
    await act(async () => finishRead(null));

    expect(queryClient.getQueryData(sessionQueryKey)).not.toBeNull();
  });
});

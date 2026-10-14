import { act, renderHook } from '@testing-library/react-native';

import { AuthError } from '../../domain/AuthError';
import { createAuthTestKit } from '../../testing/authTestKit';
import { RESEND_COOLDOWN_SECONDS, useCheckEmailViewModel } from '../useCheckEmailViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
  }
}

describe('useCheckEmailViewModel', () => {
  it('starts with the cooldown running and resend disabled', async () => {
    const { Wrapper } = createAuthTestKit();
    const { result } = await renderHook(() => useCheckEmailViewModel('ana@casa.app'), {
      wrapper: Wrapper,
    });
    expect(result.current.state).toMatchObject({
      email: 'ana@casa.app',
      secondsLeft: RESEND_COOLDOWN_SECONDS,
      canResend: false,
      resent: false,
      error: null,
    });
  });

  it('counts down once per second and enables resend at zero', async () => {
    const { Wrapper } = createAuthTestKit();
    const { result } = await renderHook(() => useCheckEmailViewModel('ana@casa.app'), {
      wrapper: Wrapper,
    });
    await tick(10);
    expect(result.current.state.secondsLeft).toBe(RESEND_COOLDOWN_SECONDS - 10);
    expect(result.current.state.canResend).toBe(false);

    await tick(RESEND_COOLDOWN_SECONDS - 10);
    expect(result.current.state.secondsLeft).toBe(0);
    expect(result.current.state.canResend).toBe(true);
  });

  it('resends the link and restarts the cooldown', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    const request = jest.spyOn(repository, 'requestMagicLink');
    const { result } = await renderHook(() => useCheckEmailViewModel('ana@casa.app'), {
      wrapper: Wrapper,
    });
    await tick(RESEND_COOLDOWN_SECONDS);

    await act(async () => result.current.resend());
    expect(request).toHaveBeenCalledWith('ana@casa.app');
    expect(result.current.state).toMatchObject({
      resent: true,
      secondsLeft: RESEND_COOLDOWN_SECONDS,
      canResend: false,
      error: null,
    });
  });

  it('keeps the cooldown at zero and shows the reason when resending fails', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    jest.spyOn(repository, 'requestMagicLink').mockRejectedValue(new AuthError('network'));
    const { result } = await renderHook(() => useCheckEmailViewModel('ana@casa.app'), {
      wrapper: Wrapper,
    });
    await tick(RESEND_COOLDOWN_SECONDS);

    await act(async () => result.current.resend());
    expect(result.current.state.error).toContain('conexión');
    expect(result.current.state.resent).toBe(false);
    expect(result.current.state.canResend).toBe(true);
  });
});

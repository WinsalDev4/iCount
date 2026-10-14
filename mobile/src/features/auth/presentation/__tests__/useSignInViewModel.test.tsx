import { act, renderHook } from '@testing-library/react-native';

import { AuthError } from '../../domain/AuthError';
import { InMemoryAuthRepository } from '../../data/InMemoryAuthRepository';
import { createAuthTestKit } from '../../testing/authTestKit';
import { useSignInViewModel } from '../useSignInViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

describe('useSignInViewModel', () => {
  it('cannot submit until the email looks valid', async () => {
    const { Wrapper } = createAuthTestKit();
    const { result } = await renderHook(() => useSignInViewModel(), { wrapper: Wrapper });
    expect(result.current.state).toMatchObject({ status: 'idle', email: '', canSubmit: false });

    await act(async () => result.current.setEmail('ana@'));
    expect(result.current.state.canSubmit).toBe(false);

    await act(async () => result.current.setEmail('ana@casa.app'));
    expect(result.current.state.canSubmit).toBe(true);
  });

  it('resolves with the normalized email when the link is requested', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    const request = jest.spyOn(repository, 'requestMagicLink');
    const { result } = await renderHook(() => useSignInViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEmail(' Ana@Casa.app '));

    let sentTo: string | null = null;
    await act(async () => {
      sentTo = await result.current.submit();
    });
    expect(sentTo).toBe('ana@casa.app');
    expect(request).toHaveBeenCalledWith('ana@casa.app');
    expect(result.current.state.status).toBe('idle');
  });

  it('shows "sending" while the request is in flight and blocks a second tap', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    let release: () => void = () => undefined;
    jest
      .spyOn(repository, 'requestMagicLink')
      .mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    const { result } = await renderHook(() => useSignInViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEmail('ana@casa.app'));

    let pending: Promise<string | null> = Promise.resolve(null);
    await act(async () => {
      pending = result.current.submit();
    });
    expect(result.current.state).toMatchObject({ status: 'sending', canSubmit: false });

    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.state.status).toBe('idle');
  });

  it('reports a failure as a Spanish message and resolves null', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    jest
      .spyOn(repository, 'requestMagicLink')
      .mockRejectedValue(new AuthError('too-many-requests'));
    const { result } = await renderHook(() => useSignInViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEmail('ana@casa.app'));

    let sentTo: string | null = 'unset';
    await act(async () => {
      sentTo = await result.current.submit();
    });
    expect(sentTo).toBeNull();
    expect(result.current.state).toMatchObject({
      status: 'error',
      message: expect.stringContaining('demasiados'),
      canSubmit: true,
    });
  });

  it('clears the error as soon as the person edits the email', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    jest.spyOn(repository, 'requestMagicLink').mockRejectedValue(new AuthError('network'));
    const { result } = await renderHook(() => useSignInViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEmail('ana@casa.app'));
    await act(async () => void (await result.current.submit()));
    expect(result.current.state.status).toBe('error');

    await act(async () => result.current.setEmail('ana@casa.app '));
    expect(result.current.state.status).toBe('idle');
  });

  it('uses the in-memory repository by default', async () => {
    const { Wrapper, repository } = createAuthTestKit();
    expect(repository).toBeInstanceOf(InMemoryAuthRepository);
    const { result } = await renderHook(() => useSignInViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEmail('leo@casa.app'));
    let sentTo: string | null = null;
    await act(async () => {
      sentTo = await result.current.submit();
    });
    expect(sentTo).toBe('leo@casa.app');
  });
});

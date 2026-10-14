import { act, renderHook } from '@testing-library/react-native';

import { authPreferencesStore } from '../../data/authPreferencesStore';
import { createAuthTestKit, fakeBiometrics } from '../../testing/authTestKit';
import { useBiometricsViewModel } from '../useBiometricsViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() =>
  authPreferencesStore.setState({
    hydrated: true,
    biometricsEnabled: false,
    biometricsPrompted: false,
  }),
);

describe('useBiometricsViewModel', () => {
  it('asks the device whether biometrics are available', async () => {
    const { Wrapper } = createAuthTestKit({ biometrics: fakeBiometrics({ available: true }) });
    const { result } = await renderHook(() => useBiometricsViewModel(), { wrapper: Wrapper });
    expect(result.current.state.available).toBe(true);
    expect(result.current.state.enabled).toBe(false);
  });

  it('reports unavailable devices, also when the check itself throws', async () => {
    const biometrics = fakeBiometrics({ available: false });
    biometrics.isAvailable.mockRejectedValue(new Error('sensor error'));
    const { Wrapper } = createAuthTestKit({ biometrics });
    const { result } = await renderHook(() => useBiometricsViewModel(), { wrapper: Wrapper });
    await act(async () => {});
    expect(result.current.state.available).toBe(false);
  });

  it('turning it on needs the person to pass the check once', async () => {
    const biometrics = fakeBiometrics({ passes: true });
    const { Wrapper } = createAuthTestKit({ biometrics });
    const { result } = await renderHook(() => useBiometricsViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEnabled(true));

    expect(biometrics.authenticate).toHaveBeenCalledTimes(1);
    expect(authPreferencesStore.getState().biometricsEnabled).toBe(true);
    expect(result.current.state).toMatchObject({ enabled: true, busy: false, error: null });
  });

  it('stays off, with a message, if the check is not passed', async () => {
    const { Wrapper } = createAuthTestKit({ biometrics: fakeBiometrics({ passes: false }) });
    const { result } = await renderHook(() => useBiometricsViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEnabled(true));

    expect(authPreferencesStore.getState().biometricsEnabled).toBe(false);
    expect(result.current.state.error).toContain('confirmar');
  });

  it('stays off, with a message, if the sensor throws', async () => {
    const biometrics = fakeBiometrics();
    biometrics.authenticate.mockRejectedValue(new Error('locked out'));
    const { Wrapper } = createAuthTestKit({ biometrics });
    const { result } = await renderHook(() => useBiometricsViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEnabled(true));

    expect(authPreferencesStore.getState().biometricsEnabled).toBe(false);
    expect(result.current.state.error).toContain('biometría');
    expect(result.current.state.busy).toBe(false);
  });

  it('turning it off needs no check', async () => {
    authPreferencesStore.setState({ biometricsEnabled: true });
    const biometrics = fakeBiometrics();
    const { Wrapper } = createAuthTestKit({ biometrics });
    const { result } = await renderHook(() => useBiometricsViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.setEnabled(false));

    expect(biometrics.authenticate).not.toHaveBeenCalled();
    expect(authPreferencesStore.getState().biometricsEnabled).toBe(false);
  });

  it('marks the offer as shown so it is not repeated', async () => {
    const { Wrapper } = createAuthTestKit();
    const { result } = await renderHook(() => useBiometricsViewModel(), { wrapper: Wrapper });
    await act(async () => result.current.markPrompted());
    expect(authPreferencesStore.getState().biometricsPrompted).toBe(true);
  });
});

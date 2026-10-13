import { act, renderHook } from '@testing-library/react-native';

import { onboardingStore } from '../../data/onboardingStore';
import { useOnboardingViewModel } from '../useOnboardingViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

async function setStore(partial: { hydrated: boolean; onboardingCompleted: boolean }) {
  await act(() => onboardingStore.setState(partial));
}

beforeEach(async () => setStore({ hydrated: true, onboardingCompleted: false }));

describe('useOnboardingViewModel', () => {
  it('is loading until the persisted flag has been read', async () => {
    await setStore({ hydrated: false, onboardingCompleted: false });
    const { result } = await renderHook(() => useOnboardingViewModel());
    expect(result.current.state.status).toBe('loading');
  });

  it('starts on the first step with Siguiente and Saltar', async () => {
    const { result } = await renderHook(() => useOnboardingViewModel());
    const { state } = result.current;
    if (state.status !== 'active') throw new Error('expected active');
    expect(state.stepIndex).toBe(0);
    expect(state.primaryLabel).toBe('Siguiente');
    expect(state.canSkip).toBe(true);
    expect(state.isLast).toBe(false);
    expect(state.steps).toHaveLength(3);
  });

  it('formats money and percent figures ready to print', async () => {
    const { result } = await renderHook(() => useOnboardingViewModel());
    const { state } = result.current;
    if (state.status !== 'active') throw new Error('expected active');
    expect(state.steps[0]?.figure).toMatch(/1\.?534,75/);
    expect(state.steps[0]?.figure).toContain('€');
    expect(state.steps[2]?.figure).toBe('50 %');
  });

  it('next() advances one step at a time', async () => {
    const { result } = await renderHook(() => useOnboardingViewModel());
    await act(async () => result.current.next());
    expect(result.current.state).toMatchObject({ status: 'active', stepIndex: 1 });
    await act(async () => result.current.next());
    expect(result.current.state).toMatchObject({
      status: 'active',
      stepIndex: 2,
      isLast: true,
      primaryLabel: 'Empezar',
      canSkip: false,
    });
  });

  it('next() on the last step completes and persists the flag', async () => {
    const { result } = await renderHook(() => useOnboardingViewModel());
    await act(async () => result.current.goTo(2));
    await act(async () => result.current.next());
    expect(result.current.state.status).toBe('completed');
    expect(onboardingStore.getState().onboardingCompleted).toBe(true);
  });

  it('skip() completes from any step', async () => {
    const { result } = await renderHook(() => useOnboardingViewModel());
    await act(async () => result.current.skip());
    expect(result.current.state.status).toBe('completed');
    expect(onboardingStore.getState().onboardingCompleted).toBe(true);
  });

  it('goTo() follows a swipe and clamps out-of-range pages', async () => {
    const { result } = await renderHook(() => useOnboardingViewModel());
    await act(async () => result.current.goTo(1));
    expect(result.current.state).toMatchObject({ stepIndex: 1 });
    await act(async () => result.current.goTo(99));
    expect(result.current.state).toMatchObject({ stepIndex: 2 });
    await act(async () => result.current.goTo(-5));
    expect(result.current.state).toMatchObject({ stepIndex: 0 });
  });

  it('is completed right away when the flag was already stored', async () => {
    await setStore({ hydrated: true, onboardingCompleted: true });
    const { result } = await renderHook(() => useOnboardingViewModel());
    expect(result.current.state.status).toBe('completed');
  });
});

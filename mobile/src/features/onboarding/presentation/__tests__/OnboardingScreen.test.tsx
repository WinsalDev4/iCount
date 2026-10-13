import '@testing-library/react-native/matchers';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { onboardingStore } from '../../data/onboardingStore';
import { OnboardingScreen } from '../OnboardingScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-reanimated', () => jest.requireActual('@/shared/testing/reanimatedStub'));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <OnboardingScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(async () => {
  await act(() => onboardingStore.setState({ hydrated: true, onboardingCompleted: false }));
});

describe('OnboardingScreen', () => {
  it('shows the three steps, Saltar and Siguiente', async () => {
    await renderScreen();
    expect(screen.getByText('Sabe cuánto te queda')).toBeOnTheScreen();
    expect(screen.getByText('Gasta sin sorpresas')).toBeOnTheScreen();
    expect(screen.getByText('Mejor en compañía')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Saltar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeOnTheScreen();
  });

  it('reports the current step to screen readers', async () => {
    await renderScreen();
    expect(screen.getByRole('progressbar', { name: 'Paso' })).toHaveAccessibilityValue({
      min: 1,
      max: 3,
      now: 1,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('progressbar', { name: 'Paso' })).toHaveAccessibilityValue({
      now: 2,
    });
  });

  it('turns the primary button into Empezar on the last step and hides Saltar', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Saltar' })).toBeNull();
  });

  it('Empezar finishes and redirects home', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
    expect(onboardingStore.getState().onboardingCompleted).toBe(true);
  });

  it('Saltar finishes straight away', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Saltar' }));
    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
  });

  it('renders nothing of the intro while the flag is still being read', async () => {
    await act(() => onboardingStore.setState({ hydrated: false }));
    await renderScreen();
    expect(screen.queryByText('Sabe cuánto te queda')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
  });

  it('redirects immediately when the intro was already seen', async () => {
    await act(() => onboardingStore.setState({ onboardingCompleted: true }));
    await renderScreen();
    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
  });
});

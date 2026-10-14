import '@testing-library/react-native/matchers';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { accessStore } from '@/features/auth/data/accessStore';
import { authPreferencesStore } from '@/features/auth/data/authPreferencesStore';
import { InMemoryAuthRepository } from '@/features/auth/data/InMemoryAuthRepository';
import type { Session } from '@/features/auth/domain/User';
import { onboardingStore } from '@/features/onboarding/data/onboardingStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-router/testing-library installs its own (empty) reanimated mock, so the real onboarding
// pager cannot render here; its own tests cover it. Here it only has to be "the screen shown".
jest.mock('@/features/onboarding/presentation/OnboardingScreen', () => ({
  OnboardingScreen: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>Sabe cuánto te queda</Text>;
  },
}));

const mockBiometrics = { isAvailable: jest.fn(), authenticate: jest.fn() };
jest.mock('@/core/auth/biometrics', () => ({
  expoBiometrics: {
    isAvailable: () => mockBiometrics.isAvailable(),
    authenticate: (reason: string) => mockBiometrics.authenticate(reason),
  },
}));

/**
 * Renders the real route tree of `src/app` with the real access gate (onboarding → sign-in →
 * biometric lock → app). Deep links are covered through `initialUrl`: `icount://history`
 * resolves through the same path → route table.
 *
 * Note: expo-router's own matchers (`toHavePathname`…) are not usable here because its testing
 * helpers call RNTL's `render` synchronously while RNTL v14 made it async. We assert on what
 * the user sees instead (which tab is selected, which screen is shown).
 */
// Resolved from the working directory (jest runs with cwd = mobile/).
const appDir = './src/app';

const ana: Session = {
  user: { id: 'u1' as Session['user']['id'], email: 'ana@casa.app', displayName: null },
};

interface Scenario {
  onboardingCompleted?: boolean;
  session?: Session | null;
  biometricsEnabled?: boolean;
  unlocked?: boolean;
  biometricsAvailable?: boolean;
  biometricPasses?: boolean;
  initialUrl?: string;
}

async function renderApp({
  onboardingCompleted = true,
  session = ana,
  biometricsEnabled = false,
  unlocked = true,
  biometricsAvailable = false,
  biometricPasses = true,
  initialUrl = '/',
}: Scenario = {}) {
  jest.spyOn(InMemoryAuthRepository.prototype, 'getSession').mockResolvedValue(session);
  mockBiometrics.isAvailable.mockResolvedValue(biometricsAvailable);
  mockBiometrics.authenticate.mockResolvedValue(biometricPasses);
  await act(async () => {
    onboardingStore.setState({ hydrated: true, onboardingCompleted });
    authPreferencesStore.setState({ hydrated: true, biometricsEnabled, biometricsPrompted: false });
    accessStore.setState({ unlocked });
  });
  await renderRouter(appDir, { initialUrl });
  // The session is read asynchronously; let the access gate settle.
  await settle();
}

jest.setTimeout(30_000);

/**
 * renderRouter installs fake timers, and TanStack Query schedules its notifications with
 * setTimeout: without advancing them the session query never reaches React.
 */
async function settle() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
  }
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('route protection', () => {
  it('shows the onboarding to a first-time user', async () => {
    await renderApp({ onboardingCompleted: false, session: null });
    expect(screen.getByText('Sabe cuánto te queda')).toBeOnTheScreen();
  });

  it('keeps a first-time user in the onboarding even from a deep link', async () => {
    await renderApp({ onboardingCompleted: false, session: null, initialUrl: '/history' });
    expect(screen.getByText('Sabe cuánto te queda')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Historial' })).toBeNull();
  });

  it('asks a signed-out user for their email', async () => {
    await renderApp({ session: null });
    expect(screen.getByRole('header', { name: 'Entra sin contraseña' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Inicio' })).toBeNull();
  });

  it('keeps a signed-out user out of the app even from a deep link', async () => {
    await renderApp({ session: null, initialUrl: '/household' });
    expect(screen.getByRole('header', { name: 'Entra sin contraseña' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Hogar' })).toBeNull();
  });

  it('locks the app on a cold start when the biometric unlock is on', async () => {
    await renderApp({ biometricsEnabled: true, unlocked: false, biometricPasses: false });
    expect(screen.getByRole('header', { name: 'iCount está bloqueado' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Inicio' })).toBeNull();
  });

  it('opens the app once the biometric check passes', async () => {
    await renderApp({ biometricsEnabled: true, unlocked: false });
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });
});

describe('sign-in flow', () => {
  it('goes from email to "check your mail" and into the app with the link', async () => {
    await renderApp({ session: null });
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'Leo@Casa.app');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviarme el enlace' }));
    await settle();
    expect(screen.getByRole('header', { name: 'Revisa tu correo' })).toBeOnTheScreen();
    expect(screen.getByText('leo@casa.app')).toBeOnTheScreen();

    // Memory mode: the shortcut plays the part of opening the emailed link.
    await fireEvent.press(screen.getByRole('button', { name: 'Simular que abro el enlace' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it('does not let an invalid email through', async () => {
    await renderApp({ session: null });
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'no-es-un-correo');
    expect(screen.getByRole('button', { name: 'Enviarme el enlace' })).toBeDisabled();
  });

  it('signs in from the deep link icount://auth/verify?token=…', async () => {
    await renderApp({ session: null, initialUrl: '/auth/verify?token=abc123' });
    await settle();
    await settle();
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it('offers the biometric opt-in once, when the device supports it', async () => {
    await renderApp({
      session: null,
      biometricsAvailable: true,
      initialUrl: '/auth/verify?token=abc123',
    });
    await settle();
    expect(
      screen.getByRole('header', { name: 'Abre iCount con tu cara o huella' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ahora no' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it('explains a link without token instead of failing silently', async () => {
    await renderApp({ session: null, initialUrl: '/auth/verify' });
    await settle();
    expect(screen.getByText('No hemos podido entrar')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pedir un enlace nuevo' })).toBeOnTheScreen();
  });

  it('signs out from the account card and returns to the email screen', async () => {
    await renderApp({ initialUrl: '/household' });
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await settle();
    expect(screen.getByRole('header', { name: 'Entra sin contraseña' })).toBeOnTheScreen();
  });
});

describe('navigation', () => {
  it('opens on the Inicio tab', async () => {
    await renderApp();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it.each([
    ['/history', 'Historial'],
    ['/plan', 'Planificar'],
    ['/household', 'Hogar'],
  ])('deep link %s lands on its tab', async (url, label) => {
    await renderApp({ initialUrl: url });
    expect(screen.getByRole('tab', { name: label })).toBeSelected();
    expect(screen.getByRole('header', { name: label })).toBeOnTheScreen();
  });

  it('switches tab when the bar is tapped', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Planificar' }));
    expect(screen.getByRole('tab', { name: 'Planificar' })).toBeSelected();
    expect(screen.getByRole('header', { name: 'Planificar' })).toBeOnTheScreen();
  });

  it('opens the add modal from the central button and closes it again', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir movimiento' }));
    expect(screen.getByRole('header', { name: 'Añadir movimiento' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    await settle();
    expect(screen.queryByRole('header', { name: 'Añadir movimiento' })).toBeNull();
  });

  it('deep link /add opens the modal directly', async () => {
    await renderApp({ initialUrl: '/add' });
    expect(screen.getByRole('header', { name: 'Añadir movimiento' })).toBeOnTheScreen();
  });
});

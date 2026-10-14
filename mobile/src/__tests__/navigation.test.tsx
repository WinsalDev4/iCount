import '@testing-library/react-native/matchers';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { accessStore } from '@/features/auth/data/accessStore';
import { authPreferencesStore } from '@/features/auth/data/authPreferencesStore';
import { InMemoryAuthRepository } from '@/features/auth/data/InMemoryAuthRepository';
import type { Session } from '@/features/auth/domain/User';
import { resetSharedMemoryTransactionRepository } from '@/features/transactions/data/sharedMemoryRepository';
import { setupStore } from '@/features/household/data/setupStore';
import { InMemoryHouseholdRepository } from '@/features/household/data/InMemoryHouseholdRepository';
import type { Household } from '@/features/household/domain/Household';
import { onboardingStore } from '@/features/onboarding/data/onboardingStore';

jest.mock('@shopify/flash-list', () => jest.requireActual('@/shared/testing/flashListStub'));
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

const casa: Household = {
  id: 'h1' as Household['id'],
  name: 'Casa',
  kind: 'personal',
  currency: 'EUR',
  splitRule: { kind: 'equal' },
  members: [],
};

interface Scenario {
  households?: readonly Household[];
  onboardingCompleted?: boolean;
  session?: Session | null;
  biometricsEnabled?: boolean;
  unlocked?: boolean;
  biometricsAvailable?: boolean;
  biometricPasses?: boolean;
  initialUrl?: string;
}

async function renderApp({
  households = [casa],
  onboardingCompleted = true,
  session = ana,
  biometricsEnabled = false,
  unlocked = true,
  biometricsAvailable = false,
  biometricPasses = true,
  initialUrl = '/',
}: Scenario = {}) {
  jest.spyOn(InMemoryAuthRepository.prototype, 'getSession').mockResolvedValue(session);
  jest.spyOn(InMemoryHouseholdRepository.prototype, 'getMine').mockResolvedValue(households);
  setupStore.setState({ pendingHouseholdId: null });
  resetSharedMemoryTransactionRepository();
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

describe('household setup', () => {
  it('sends a signed-in user without a household to the setup', async () => {
    await renderApp({ households: [] });
    expect(screen.getByRole('header', { name: '¿Cómo vas a usar iCount?' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Inicio' })).toBeNull();
  });

  it('keeps that user in the setup even from a deep link', async () => {
    await renderApp({ households: [], initialUrl: '/plan' });
    expect(screen.getByRole('header', { name: '¿Cómo vas a usar iCount?' })).toBeOnTheScreen();
  });

  it('a personal household is created in two taps and opens the app', async () => {
    await renderApp({ households: [] });
    await fireEvent.press(screen.getByRole('button', { name: 'Solo yo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Crear' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it('joining with a code opens the app', async () => {
    await renderApp({ households: [] });
    await fireEvent.press(screen.getByRole('button', { name: 'Tengo un código' }));
    await fireEvent.changeText(screen.getByLabelText('Código de invitación'), 'wxyz-6789');
    await fireEvent.press(screen.getByRole('button', { name: 'Unirme' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it('a bad code shows the reason and stays on the setup', async () => {
    await renderApp({ households: [] });
    await fireEvent.press(screen.getByRole('button', { name: 'Tengo un código' }));
    await fireEvent.changeText(screen.getByLabelText('Código de invitación'), 'EXPIRED1');
    await fireEvent.press(screen.getByRole('button', { name: 'Unirme' }));
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent(/caducado/);
    expect(screen.queryByRole('tab', { name: 'Inicio' })).toBeNull();
  });

  it('a shared household goes through invite and split before opening the app', async () => {
    await renderApp({ households: [] });
    await fireEvent.press(screen.getByRole('button', { name: 'Compartida' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre del hogar'), 'Casa Ana & Leo');
    await fireEvent.press(screen.getByRole('button', { name: 'Crear e invitar' }));
    await settle();

    // The household exists already, yet the user is still in the setup (invite step).
    expect(screen.getByRole('header', { name: 'Invita a tu gente' })).toBeOnTheScreen();
    expect(screen.getByLabelText(/Código [A-Z0-9]{4}-[A-Z0-9]{4}/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await settle();

    expect(screen.getByRole('header', { name: '¿Cómo repartís los gastos?' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Según ingresos' }));
    expect(screen.getByRole('radio', { name: 'Según ingresos' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar y empezar' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it('"Más tarde" skips the split rule and opens the app', async () => {
    await renderApp({ households: [] });
    await fireEvent.press(screen.getByRole('button', { name: 'Compartida' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre del hogar'), 'Piso');
    await fireEvent.press(screen.getByRole('button', { name: 'Crear e invitar' }));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Más tarde' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });
});

describe('navigation', () => {
  it('opens on the Inicio tab', async () => {
    await renderApp();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it.each([
    ['/plan', 'Planificar'],
    ['/household', 'Hogar'],
  ])('deep link %s lands on its tab', async (url, label) => {
    await renderApp({ initialUrl: url });
    expect(screen.getByRole('tab', { name: label })).toBeSelected();
    expect(screen.getByRole('header', { name: label })).toBeOnTheScreen();
  });

  it('deep link /history lands on the history tab with its calendar', async () => {
    await renderApp({ initialUrl: '/history' });
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Calendario del mes')).toBeOnTheScreen();
  });

  it('opens a movement from the history and comes back', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Historial' }));
    await settle();
    // Demo data: pick any day of the calendar that has spending by searching all dates.
    await fireEvent.press(screen.getByRole('tab', { name: 'Gastos' }));
    await settle();
    await settle();
    await fireEvent.press(screen.getAllByRole('button', { name: /Alquiler/ })[0] as never);
    await settle();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen();
    expect(screen.getAllByText('Alquiler').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeSelected();
  });

  it('deep link /transaction/<id> explains a movement that does not exist', async () => {
    await renderApp({ initialUrl: '/transaction/nope' });
    await settle();
    expect(screen.getByText('Este movimiento ya no existe')).toBeOnTheScreen();
  });

  it('keeps a signed-out user out of a movement deep link', async () => {
    await renderApp({ session: null, initialUrl: '/transaction/nope' });
    expect(screen.getByRole('header', { name: 'Entra sin contraseña' })).toBeOnTheScreen();
  });

  it('Planificar leads to the budgets list and back', async () => {
    await renderApp({ initialUrl: '/plan' });
    await fireEvent.press(screen.getByRole('button', { name: 'Presupuestos' }));
    await settle();
    await settle();
    expect(screen.getByRole('header', { name: 'Presupuestos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nuevo presupuesto' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'Planificar' })).toBeSelected();
  });

  it('keeps a signed-out user out of the budgets deep link', async () => {
    await renderApp({ session: null, initialUrl: '/budgets' });
    expect(screen.getByRole('header', { name: 'Entra sin contraseña' })).toBeOnTheScreen();
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
    await settle();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    await settle();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
  });

  it('types an amount on the keypad, saves and closes the modal', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir movimiento' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled(); // nothing typed yet
    await fireEvent.press(screen.getByRole('button', { name: '1' }));
    await fireEvent.press(screen.getByRole('button', { name: '2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Coma' }));
    await fireEvent.press(screen.getByRole('button', { name: '5' }));
    expect(screen.getByLabelText('Importe 12,5 €')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await settle();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it('deep link /add opens the modal directly', async () => {
    await renderApp({ initialUrl: '/add' });
    await settle();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeOnTheScreen();
  });
});

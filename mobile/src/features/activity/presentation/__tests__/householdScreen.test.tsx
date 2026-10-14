import '@testing-library/react-native/matchers';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createHouseholdTabTestKit } from '@/features/household/testing/householdTabTestKit';

import { HouseholdScreen } from '../HouseholdScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));
// The account card has its own tests; here it would need the real biometrics.
jest.mock('@/features/auth/presentation/AccountCard', () => ({ AccountCard: () => null }));

beforeEach(() => {
  mockPush.mockClear();
  jest.useFakeTimers({
    now: new Date(2026, 9, 14, 10),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
    ],
  });
});
afterEach(() => jest.useRealTimers());

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderTab(options: { shared?: boolean } = {}) {
  const kit = createHouseholdTabTestKit(options);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <kit.Wrapper>
        <HouseholdScreen />
      </kit.Wrapper>
    </SafeAreaProvider>,
  );
  return kit;
}

describe('HouseholdScreen', () => {
  it('shows who owes whom, what is pending and the way to settle', async () => {
    await renderTab();
    await waitFor(() => expect(screen.getByText(/^Debes 30,63/)).toBeOnTheScreen());
    expect(screen.getByText(/Tú debes 30,63.* a Ana/)).toBeOnTheScreen();
    expect(screen.getByText('Hay 2 gastos por revisar que aún no cuentan.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Saldar cuentas' }));
    expect(mockPush).toHaveBeenCalledWith('/settle');
  });

  it('lists the activity and the members with their rule', async () => {
    await renderTab();
    await waitFor(() => expect(screen.getByText('Ana añadió «Compra semanal»')).toBeOnTheScreen());
    expect(screen.getByText('Tú aprobaste «Factura de la luz»')).toBeOnTheScreen();
    expect(screen.getByText('Leo (tú)')).toBeOnTheScreen();
    expect(screen.getByText(/Administrador/)).toBeOnTheScreen();
    expect(screen.getByText(/Miembro · Ingresos: 2\.?000,00/)).toBeOnTheScreen();
    expect(screen.getByText('A partes iguales')).toBeOnTheScreen();
  });

  it('the review filter only shows what waits for my approval', async () => {
    await renderTab();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Por revisar (2)' })).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Por revisar (2)' }));
    await waitFor(() => expect(screen.queryByText(/Factura de la luz/)).toBeNull());
    await waitFor(() => expect(screen.getByText('Ana añadió «Compra semanal»')).toBeOnTheScreen());
    expect(screen.getByText('Ana añadió «Cena en casa de amigos»')).toBeOnTheScreen();
  });

  it('approving updates the balance and the pending count', async () => {
    await renderTab();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(2));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Aprobar' })[0]!);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByText('Hay 1 gasto por revisar que aún no cuenta.')).toBeOnTheScreen(),
    );
    expect(screen.getByRole('tab', { name: 'Por revisar (1)' })).toBeOnTheScreen();
    expect(screen.getAllByText(/Tú aprobaste «/)).toHaveLength(2); // the light bill and this one
  });

  it('rejecting needs a reason', async () => {
    await renderTab();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(2),
    );
    await fireEvent.press(screen.getAllByRole('button', { name: 'Rechazar' })[1]!);
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Motivo del rechazo'), 'No estuve');
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(1),
    );
    expect(screen.getAllByText(/Rechazado/).length).toBeGreaterThan(0);
  });

  it('comments on a movement', async () => {
    await renderTab();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Comentar' }).length).toBeGreaterThan(0),
    );
    await fireEvent.press(screen.getAllByRole('button', { name: 'Comentar' })[0]!);
    const send = await screen.findByRole('button', { name: 'Enviar comentario' });
    expect(send).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText('Escribe un comentario'),
      '¿Era el Mercadona?',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar comentario' }));
    await waitFor(() => expect(screen.getByText('¿Era el Mercadona?')).toBeOnTheScreen());
    expect(screen.getByText(/Tú · hoy/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Comentarios (1)' })).toBeOnTheScreen();
  });

  it('opens the movement behind a feed row', async () => {
    await renderTab();
    await waitFor(() => expect(screen.getByText('Ana añadió «Compra semanal»')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: /^Ana añadió «Compra semanal»/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction/[id]',
      params: { id: expect.any(String) },
    });
  });

  it('invites with a code that can be shared', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
    await renderTab();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Invitar a alguien' })).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Invitar a alguien' }));
    await waitFor(() => expect(screen.getByLabelText('Código ABCD-2345')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Compartir código' }));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('ABCD-2345') });
    share.mockRestore();
  });

  it('a household of one has no balance, only an invitation', async () => {
    await renderTab({ shared: false });
    await waitFor(() =>
      expect(screen.getByText('Ahora mismo estás tú solo en este hogar.')).toBeOnTheScreen(),
    );
    expect(screen.queryByText('BALANCE')).toBeNull();
    expect(screen.getByRole('button', { name: 'Invitar a alguien' })).toBeOnTheScreen();
  });

  it('settled households say so', async () => {
    const kit = createHouseholdTabTestKit();
    await kit.settlements.balance('h1'); // seeds
    await kit.settlements.create({
      householdId: 'h1',
      from: kit.household.members[0]!.userId,
      to: kit.household.members[1]!.userId,
      amount: (await kit.settlements.balance('h1')).suggestedTransfers[0]!.amount,
      method: 'cash',
      note: '',
      settledOn: new Date(2026, 9, 14),
    });
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <kit.Wrapper>
          <HouseholdScreen />
        </kit.Wrapper>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText('Estás al día')).toBeOnTheScreen());
    expect(screen.getByText('No hay deudas entre vosotros.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Saldar cuentas' })).toBeNull();
  });
});

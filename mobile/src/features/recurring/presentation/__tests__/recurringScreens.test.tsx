import '@testing-library/react-native/matchers';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import { remindersPreferenceStore } from '../../data/remindersPreferenceStore';
import type { NewRecurringPayment } from '../../domain/RecurringPayment';
import { createRecurringTestKit } from '../../testing/recurringTestKit';
import { RecurringFormScreen } from '../RecurringFormScreen';
import { RecurringScreen } from '../RecurringScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockParams = {};
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
const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const netflix: NewRecurringPayment = {
  householdId: 'h1',
  name: 'Netflix',
  kind: 'subscription',
  type: 'expense',
  amount: eur(1_299),
  categoryId: 'leisure' as CategoryId,
  rule: { unit: 'month', interval: 1, dayOfMonth: 17 },
  startDate: new Date(2026, 0, 17),
  shared: false,
};
const salary: NewRecurringPayment = {
  ...netflix,
  name: 'Nómina',
  kind: 'income',
  type: 'income',
  amount: eur(195_000),
  categoryId: 'salary' as CategoryId,
  rule: { unit: 'month', interval: 1, dayOfMonth: 28 },
};

async function renderScreen(ui: React.ReactElement, ...items: NewRecurringPayment[]) {
  const kit = createRecurringTestKit({ now: () => new Date() });
  const payments = [];
  for (const item of items) payments.push(await kit.repository.create(item));
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <kit.Wrapper>{ui}</kit.Wrapper>
    </SafeAreaProvider>,
  );
  return { ...kit, payments };
}

describe('RecurringScreen', () => {
  it('shows what falls due soon and the payments themselves', async () => {
    await renderScreen(<RecurringScreen />, netflix, salary);
    await waitFor(() => expect(screen.getByText('PRÓXIMOS 30 DÍAS')).toBeOnTheScreen());
    expect(screen.getAllByText('Netflix').length).toBe(2); // one due, one in the payments list
    expect(screen.getAllByText('Nómina').length).toBe(2);
    expect(screen.getByText('2 vencimientos')).toBeOnTheScreen();
    expect(screen.getByText('TUS PAGOS RECURRENTES')).toBeOnTheScreen();
    expect(screen.getByText(/Suscripción · cada mes, el día 17/)).toBeOnTheScreen();
  });

  it('invites to add the first payment when there are none', async () => {
    await renderScreen(<RecurringScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Aún no tienes pagos recurrentes/)).toBeOnTheScreen(),
    );
    expect(screen.getByText('No vence ningún pago en las próximas semanas.')).toBeOnTheScreen();
  });

  it('opens a payment to edit it and the form to add one', async () => {
    const { payments } = await renderScreen(<RecurringScreen />, netflix);
    await waitFor(() => expect(screen.getByText('TUS PAGOS RECURRENTES')).toBeOnTheScreen());
    await fireEvent.press(screen.getAllByRole('button', { name: /Netflix/ })[0]!);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/recurring/edit',
      params: { id: payments[0]?.id },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir pago recurrente' }));
    expect(mockPush).toHaveBeenCalledWith('/recurring/edit');
  });

  it('switches to the calendar, marks the days and lists the selected day', async () => {
    await renderScreen(<RecurringScreen />, netflix);
    await waitFor(() => expect(screen.getByText('TUS PAGOS RECURRENTES')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('tab', { name: 'Calendario' }));

    await waitFor(() => expect(screen.getByText('octubre de 2026')).toBeOnTheScreen());
    await waitFor(() => expect(screen.getByText(/^Pagos del mes: /)).toBeOnTheScreen());
    const day17 = screen.getByRole('button', { name: /17: 1 vencimiento/ });
    await fireEvent.press(day17);
    expect(screen.getByText('SÁBADO, 17 DE OCTUBRE')).toBeOnTheScreen();
    expect(screen.getByText('Netflix')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));
    await waitFor(() => expect(screen.getByText('noviembre de 2026')).toBeOnTheScreen());
  });

  it('asks for the notification permission only when the switch is turned on', async () => {
    const { scheduler } = await renderScreen(<RecurringScreen />, netflix);
    scheduler.permissionNow = 'undetermined';
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Avisarme el día antes' })).toBeOnTheScreen(),
    );
    expect(scheduler.requests).toHaveLength(0);

    await fireEvent(
      screen.getByRole('switch', { name: 'Avisarme el día antes' }),
      'valueChange',
      true,
    );

    await waitFor(() =>
      expect(screen.getByText(/9:00 del día antes de cada pago/)).toBeOnTheScreen(),
    );
    expect(scheduler.requests).toHaveLength(1);
    expect(remindersPreferenceStore.getState().enabled).toBe(true);
    expect(screen.getByRole('switch', { name: 'Avisarme el día antes' })).toBeChecked();
  });

  it('explains what to do when the permission is refused', async () => {
    const { scheduler } = await renderScreen(<RecurringScreen />, netflix);
    scheduler.permissionNow = 'denied';
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Avisarme el día antes' })).toBeOnTheScreen(),
    );
    await fireEvent(
      screen.getByRole('switch', { name: 'Avisarme el día antes' }),
      'valueChange',
      true,
    );
    await waitFor(() => expect(screen.getByText(/Ajustes del teléfono/)).toBeOnTheScreen());
    expect(screen.getByRole('switch', { name: 'Avisarme el día antes' })).not.toBeChecked();
  });
});

describe('RecurringFormScreen', () => {
  async function renderForm(...items: NewRecurringPayment[]) {
    const kit = createRecurringTestKit({ now: () => new Date() });
    const payments = [];
    for (const item of items) payments.push(await kit.repository.create(item));
    if (items.length > 0) mockParams = { id: payments[0]?.id };
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <kit.Wrapper>
          <RecurringFormScreen />
        </kit.Wrapper>
      </SafeAreaProvider>,
    );
    return { ...kit, payments };
  }

  it('creates a payment filling the form and goes back', async () => {
    const { repository } = await renderForm();
    await waitFor(() => expect(screen.getByText('Nuevo pago recurrente')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Añadir pago' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Gimnasio');
    await fireEvent.press(screen.getByRole('button', { name: 'Suscripción' }));
    await fireEvent.changeText(screen.getByLabelText('Importe'), '29,90');
    await fireEvent.press(screen.getByRole('button', { name: 'Cada 3 meses' }));
    await fireEvent.press(screen.getByRole('button', { name: '+1 día' }));
    expect(screen.getByRole('button', { name: 'Añadir pago' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir pago' }));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    const [created] = await repository.list('h1');
    expect(created).toMatchObject({
      name: 'Gimnasio',
      kind: 'subscription',
      categoryId: 'leisure',
      rule: { unit: 'month', interval: 3, dayOfMonth: 15 },
    });
    expect(created?.amount.amountMinor).toBe(2_990);
  });

  it('offers to share with the household and shows the amount error while typing', async () => {
    await renderForm();
    await waitFor(() => expect(screen.getByText('Nuevo pago recurrente')).toBeOnTheScreen());
    expect(screen.getByRole('switch', { name: 'Compartido con el hogar' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Importe'), 'mucho');
    expect(screen.getByText(/Escribe un importe mayor que cero/)).toBeOnTheScreen();
  });

  it('edits an existing payment (the first due date is history)', async () => {
    await renderForm(netflix);
    await waitFor(() => expect(screen.getByText('Editar pago')).toBeOnTheScreen());
    expect(screen.getByText('17 de enero de 2026')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '+1 mes' })).toBeNull();
    expect(screen.getByDisplayValue('Netflix')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('asks before deleting and goes back after deleting', async () => {
    const { repository } = await renderForm(netflix);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Eliminar pago' })).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar pago' }));
    expect(screen.getByText('¿Eliminar este pago?')).toBeOnTheScreen();
    expect(await repository.list('h1')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(await repository.list('h1')).toEqual([]);
  });

  it('explains a payment that no longer exists', async () => {
    mockParams = { id: 'nope' };
    const kit = createRecurringTestKit();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <kit.Wrapper>
          <RecurringFormScreen />
        </kit.Wrapper>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText('Este pago ya no existe')).toBeOnTheScreen());
  });
});

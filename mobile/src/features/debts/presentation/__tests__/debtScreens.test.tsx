import '@testing-library/react-native/matchers';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Money } from '@/core/domain/Money';

import type { NewDebt } from '../../domain/Debt';
import { createDebtsTestKit } from '../../testing/debtsTestKit';
import { DebtDetailScreen } from '../DebtDetailScreen';
import { DebtFormScreen } from '../DebtFormScreen';
import { DebtsScreen } from '../DebtsScreen';
import { StrategyScreen } from '../StrategyScreen';

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
const car: NewDebt = {
  householdId: 'h1',
  name: 'Préstamo del coche',
  kind: 'car',
  principal: eur(1_200_000),
  annualRateBps: 690,
  startDate: new Date(2025, 9, 15),
  termMonths: 60,
};
const card: NewDebt = {
  householdId: 'h1',
  name: 'Tarjeta',
  kind: 'credit-card',
  principal: eur(300_000),
  annualRateBps: 2_100,
  startDate: new Date(2026, 5, 1),
  termMonths: 24,
};

async function renderWith(ui: React.ReactElement, ...loans: NewDebt[]) {
  const kit = createDebtsTestKit({ now: () => new Date() });
  const debts = [];
  for (const l of loans) debts.push(await kit.repository.create(l));
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <kit.Wrapper>{ui}</kit.Wrapper>
    </SafeAreaProvider>,
  );
  return { ...kit, debts };
}

describe('DebtsScreen', () => {
  it('shows what is owed in total and a card per debt', async () => {
    await renderWith(<DebtsScreen />, car, card);
    await waitFor(() => expect(screen.getByText('PENDIENTE DE PAGAR')).toBeOnTheScreen());
    expect(screen.getByText('Préstamo del coche')).toBeOnTheScreen();
    expect(screen.getByText('Tarjeta')).toBeOnTheScreen();
    expect(screen.getByText(/2 deudas/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Debes .* en total, con .* de cuotas al mes/)).toBeOnTheScreen();
  });

  it('opens the detail of a debt and the add and strategy screens', async () => {
    const { debts } = await renderWith(<DebtsScreen />, car, card);
    await waitFor(() => expect(screen.getByText('Tarjeta')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: /^Tarjeta,/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/debts/[id]',
      params: { id: debts[1]?.id },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir deuda' }));
    expect(mockPush).toHaveBeenCalledWith('/debts/edit');
    await fireEvent.press(screen.getByRole('button', { name: 'Avalancha o bola de nieve' }));
    expect(mockPush).toHaveBeenCalledWith('/debts/strategy');
  });

  it('invites to add the first debt, without the strategy button', async () => {
    await renderWith(<DebtsScreen />);
    await waitFor(() => expect(screen.getByText(/Aún no has registrado deudas/)).toBeOnTheScreen());
    expect(screen.getByText('No debes nada. ¡Enhorabuena!')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Avalancha o bola de nieve' })).toBeNull();
  });
});

describe('DebtDetailScreen', () => {
  async function renderDetail() {
    const kit = createDebtsTestKit({ now: () => new Date() });
    const debt = await kit.repository.create(car);
    mockParams = { id: debt.id };
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <kit.Wrapper>
          <DebtDetailScreen />
        </kit.Wrapper>
      </SafeAreaProvider>,
    );
    return { ...kit, debt };
  }

  it('shows the ring, the instalment, the end date and the simulator', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByText('Préstamo del coche')).toBeOnTheScreen());
    expect(screen.getByRole('progressbar', { name: /Pagado: \d+ %/ })).toBeOnTheScreen();
    expect(screen.getByText('Cuota mensual')).toBeOnTheScreen();
    expect(screen.getAllByText(/septiembre de 2030/).length).toBeGreaterThan(0);
    expect(screen.getByText('¿Y SI PAGAS DE MÁS CADA MES?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /\+100/ })).toBeOnTheScreen();
  });

  it('simulates the extra payment with the chips', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByText(/Terminas .* antes/)).toBeOnTheScreen());
    expect(screen.getByText(/Ahorras .* en intereses/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sin extra' }));
    expect(screen.getByText('Elige un importe para ver cuánto te ahorras.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /\+200/ }));
    expect(screen.getByText(/Terminas .* antes/)).toBeOnTheScreen();
  });

  it('asks before deleting and goes back after deleting', async () => {
    const { repository } = await renderDetail();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Eliminar deuda' })).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar deuda' }));
    expect(screen.getByText('¿Eliminar esta deuda?')).toBeOnTheScreen();
    expect(await repository.list('h1')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(await repository.list('h1')).toEqual([]);
  });

  it('edit goes to the form with the id', async () => {
    const { debt } = await renderDetail();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Editar deuda' })).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Editar deuda' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/debts/edit', params: { id: debt.id } });
  });

  it('explains a debt that no longer exists', async () => {
    mockParams = { id: 'nope' };
    const kit = createDebtsTestKit();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <kit.Wrapper>
          <DebtDetailScreen />
        </kit.Wrapper>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText('Esta deuda ya no existe')).toBeOnTheScreen());
  });
});

describe('DebtFormScreen', () => {
  it('creates a debt filling the form and goes back', async () => {
    const kit = createDebtsTestKit({ now: () => new Date() });
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <kit.Wrapper>
          <DebtFormScreen />
        </kit.Wrapper>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText('Nueva deuda')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Añadir deuda' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Hipoteca');
    await fireEvent.press(screen.getByRole('button', { name: 'Hipoteca' }));
    await fireEvent.changeText(screen.getByLabelText('Importe prestado'), '150000');
    await fireEvent.changeText(screen.getByLabelText('Interés anual (TIN, %)'), '3,2');
    await fireEvent.changeText(screen.getByLabelText('Plazo (meses)'), '300');
    expect(screen.getByRole('button', { name: 'Añadir deuda' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir deuda' }));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    const [created] = await kit.repository.list('h1');
    expect(created).toMatchObject({
      name: 'Hipoteca',
      kind: 'mortgage',
      annualRateBps: 320,
      termMonths: 300,
    });
  });

  it('shows the field errors while typing', async () => {
    const kit = createDebtsTestKit();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <kit.Wrapper>
          <DebtFormScreen />
        </kit.Wrapper>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText('Nueva deuda')).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByLabelText('Interés anual (TIN, %)'), 'mucho');
    expect(screen.getByText('Escribe un porcentaje, p. ej. 6,9')).toBeOnTheScreen();
  });
});

describe('StrategyScreen', () => {
  it('compares both strategies and recommends one', async () => {
    await renderWith(<StrategyScreen />, car, card);
    await waitFor(() => expect(screen.getByText('¿Por cuál empiezo?')).toBeOnTheScreen());
    expect(screen.getByText('Avalancha')).toBeOnTheScreen();
    expect(screen.getByText('Bola de nieve')).toBeOnTheScreen();
    expect(screen.getAllByText('LIBRE DE DEUDAS')).toHaveLength(2);
    expect(screen.getByText(/^La avalancha te ahorra|cuestan lo mismo/)).toBeOnTheScreen();
  });

  it('changing the extra keeps working', async () => {
    await renderWith(<StrategyScreen />, car, card);
    await waitFor(() => expect(screen.getByText('Avalancha')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: /\+200/ }));
    expect(screen.getByText('Avalancha')).toBeOnTheScreen();
  });

  it('says there is nothing to compare when nothing is owed', async () => {
    await renderWith(<StrategyScreen />);
    await waitFor(() => expect(screen.getByText('No hay deudas que comparar')).toBeOnTheScreen());
  });
});

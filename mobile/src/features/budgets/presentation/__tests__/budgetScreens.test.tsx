import '@testing-library/react-native/matchers';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';
import { createTransactionsTestKit } from '@/features/transactions/testing/transactionsTestKit';

import { BudgetBar } from '../BudgetBar';
import { BudgetsScreen } from '../BudgetsScreen';
import { PlanHubScreen } from '../PlanHubScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
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

function wrap(ui: React.ReactElement) {
  return <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>;
}

describe('BudgetBar', () => {
  it('shows the title, the amounts, the remainder and a progress value for screen readers', async () => {
    await render(
      <BudgetBar
        title="Comida"
        amounts="60,00 € de 300,00 €"
        statusLabel="Quedan 240,00 €"
        ratio={0.2}
        percent={20}
        status="ok"
      />,
    );
    expect(screen.getByText('Comida')).toBeOnTheScreen();
    expect(screen.getByText('60,00 € de 300,00 €')).toBeOnTheScreen();
    expect(screen.getByText('Quedan 240,00 €')).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: 'Comida: 20 % del presupuesto' }),
    ).toHaveAccessibilityValue({
      now: 20,
    });
  });

  it('an exceeded budget shows its alert text', async () => {
    await render(
      <BudgetBar
        title="Ocio"
        amounts="a"
        statusLabel="Te has pasado 20,00 €"
        ratio={1}
        percent={120}
        status="exceeded"
      />,
    );
    expect(screen.getByText('Te has pasado 20,00 €')).toBeOnTheScreen();
  });
});

describe('BudgetsScreen', () => {
  async function renderList(withBudgets = true) {
    const kit = createTransactionsTestKit({
      memory: {
        transactions: [
          {
            id: 't1',
            type: 'expense',
            amount: eur(12_000),
            categoryId: 'leisure' as CategoryId,
            description: '',
            occurredAt: new Date(2026, 9, 5),
            householdId: 'h1',
            payerId: 'u' as never,
            shared: false,
            shares: [],
          },
        ],
      },
    });
    if (withBudgets) {
      await kit.budgetRepository.create({
        householdId: 'h1',
        categoryId: 'food' as CategoryId,
        month: { year: 2026, month: 10 },
        limit: eur(30_000),
      });
      await kit.budgetRepository.create({
        householdId: 'h1',
        categoryId: 'leisure' as CategoryId,
        month: { year: 2026, month: 10 },
        limit: eur(10_000),
      });
    }
    await render(
      wrap(
        <kit.Wrapper>
          <BudgetsScreen />
        </kit.Wrapper>,
      ),
    );
    return kit;
  }

  it('lists the budgets with the exceeded one in alert', async () => {
    await renderList();
    await waitFor(() => expect(screen.getByText('Octubre de 2026')).toBeOnTheScreen());
    expect(screen.getByRole('header', { name: 'Presupuestos' })).toBeOnTheScreen();
    expect(screen.getByText(/Te has pasado 20,00/)).toBeOnTheScreen();
    expect(screen.getByText(/Quedan 300,00/)).toBeOnTheScreen();
    expect(screen.getByText('TOTAL DEL MES')).toBeOnTheScreen();
  });

  it('opens the form, the move screen and the creation from the buttons', async () => {
    await renderList();
    await waitFor(() => expect(screen.getByText('Octubre de 2026')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Ocio' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/budgets/edit',
      params: { id: expect.any(String) },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Mover desde Comida' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/budgets/move',
      params: { id: expect.any(String) },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Nuevo presupuesto' }));
    expect(mockPush).toHaveBeenCalledWith('/budgets/edit');
  });

  it('invites to create the first budget when there are none', async () => {
    await renderList(false);
    await waitFor(() => expect(screen.getByText(/Aún no tienes presupuestos/)).toBeOnTheScreen());
    expect(screen.queryByText('TOTAL DEL MES')).toBeNull();
  });

  it('goes back with the back button', async () => {
    await renderList();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('PlanHubScreen', () => {
  it('opens budgets, debts and recurring payments', async () => {
    await render(wrap(<PlanHubScreen />));
    await fireEvent.press(screen.getByRole('button', { name: 'Presupuestos' }));
    expect(mockPush).toHaveBeenCalledWith('/budgets');

    await fireEvent.press(screen.getByRole('button', { name: 'Deudas' }));
    expect(mockPush).toHaveBeenCalledWith('/debts');

    await fireEvent.press(screen.getByRole('button', { name: 'Recurrentes' }));
    expect(mockPush).toHaveBeenCalledWith('/recurring');
    expect(screen.queryByText('Próximamente')).toBeNull();
  });
});

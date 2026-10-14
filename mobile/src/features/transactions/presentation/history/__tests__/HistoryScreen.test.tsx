import '@testing-library/react-native/matchers';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Money } from '@/core/domain/Money';

import type { CategoryId, Transaction } from '../../../domain/Transaction';
import { ME, createTransactionsTestKit } from '../../../testing/transactionsTestKit';
import { HistoryScreen } from '../HistoryScreen';

const mockPush = jest.fn();
jest.mock('@shopify/flash-list', () => jest.requireActual('@/shared/testing/flashListStub'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

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

function tx(
  id: string,
  type: Transaction['type'],
  cents: number,
  day: number,
  description: string,
): Transaction {
  return {
    id,
    type,
    amount: Money.ofMinor(cents, 'EUR'),
    categoryId: 'food' as CategoryId,
    description,
    occurredAt: new Date(2026, 9, day),
    householdId: 'h1',
    payerId: ME,
    shared: false,
    shares: [],
  };
}

async function renderHistory(transactions: Transaction[]) {
  const kit = createTransactionsTestKit({ memory: { transactions } });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <kit.Wrapper>
        <HistoryScreen />
      </kit.Wrapper>
    </SafeAreaProvider>,
  );
  return kit;
}

const data = [tx('a', 'expense', 4_200, 14, 'Supermercado'), tx('b', 'expense', 900, 12, 'Café')];

describe('HistoryScreen', () => {
  it('shows the month, the heat map and the selected day', async () => {
    await renderHistory(data);
    await waitFor(() => expect(screen.getByText('Octubre de 2026')).toBeOnTheScreen());
    expect(screen.getByLabelText('Calendario del mes')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText('Supermercado')).toBeOnTheScreen());
    expect(screen.queryByText('Café')).toBeNull(); // another day
    expect(screen.getByText('MIÉRCOLES, 14 DE OCTUBRE')).toBeOnTheScreen();
  });

  it('every day of the calendar is a labelled button with its spending', async () => {
    await renderHistory(data);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /miércoles 14: 42,00 € gastados/ }),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByRole('button', { name: /lunes 12: .*sin gastos|lunes 12: 9,00/ }),
    ).toBeOnTheScreen();
  });

  it('tapping another day lists its movements', async () => {
    await renderHistory(data);
    await waitFor(() => expect(screen.getByText('Supermercado')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: /lunes 12:/ }));
    await waitFor(() => expect(screen.getByText('Café')).toBeOnTheScreen());
    expect(screen.queryByText('Supermercado')).toBeNull();
  });

  it('moves between months, and the next-month button stops at the present', async () => {
    await renderHistory(data);
    await waitFor(() => expect(screen.getByText('Octubre de 2026')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
    await waitFor(() => expect(screen.getByText('Septiembre de 2026')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled();
  });

  it('searching switches to results from every date', async () => {
    await renderHistory(data);
    await waitFor(() => expect(screen.getByText('Supermercado')).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'cafe');
    await waitFor(() => expect(screen.getByText('RESULTADOS')).toBeOnTheScreen());
    await waitFor(() => expect(screen.getByText('Café')).toBeOnTheScreen());
    expect(screen.queryByText('Supermercado')).toBeNull();
    expect(screen.getByRole('button', { name: 'Quitar filtros' })).toBeOnTheScreen();
  });

  it('says so when nothing matches', async () => {
    await renderHistory(data);
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'zzzz');
    await waitFor(() =>
      expect(screen.getByText('Ningún movimiento coincide con tu búsqueda.')).toBeOnTheScreen(),
    );
  });

  it('says so when the day is empty', async () => {
    await renderHistory([]);
    await waitFor(() => expect(screen.getByText('Sin movimientos este día.')).toBeOnTheScreen());
  });

  it('opens the detail of a movement', async () => {
    await renderHistory(data);
    await waitFor(() => expect(screen.getByText('Supermercado')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: /Supermercado/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/transaction/[id]', params: { id: 'a' } });
  });

  it('applies the type filter from the segmented control', async () => {
    await renderHistory([tx('i', 'income', 100_000, 3, 'Nómina'), ...data]);
    await waitFor(() => expect(screen.getByText('Supermercado')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('tab', { name: 'Ingresos' }));
    await waitFor(() => expect(screen.getByText('Nómina')).toBeOnTheScreen());
    expect(screen.queryByText('Supermercado')).toBeNull();
  });
});

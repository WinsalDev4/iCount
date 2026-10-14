import '@testing-library/react-native/matchers';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Money } from '@/core/domain/Money';

import type { CategoryId, Transaction } from '../../../domain/Transaction';
import { ME, createTransactionsTestKit, householdOf } from '../../../testing/transactionsTestKit';
import { HomeScreen } from '../HomeScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => {
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

async function renderHome(transactions: Transaction[], household = householdOf('shared', true)) {
  const kit = createTransactionsTestKit({ household, memory: { transactions } });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <kit.Wrapper>
        <HomeScreen />
      </kit.Wrapper>
    </SafeAreaProvider>,
  );
  return kit;
}

describe('HomeScreen', () => {
  it('shows a spinner first, then the daily number', async () => {
    await renderHome([tx('1', 'income', 200_000, 1, 'Nómina')]);
    expect(screen.getByLabelText('Cargando')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText('DISPONIBLE HOY')).toBeOnTheScreen());
    // 2.000 € over 18 days: 111,11 €.
    expect(screen.getAllByText(/111,11/).length).toBeGreaterThanOrEqual(1);
  });

  it('reads the headline as one sentence for screen readers', async () => {
    await renderHome([tx('1', 'income', 200_000, 1, 'Nómina')]);
    await waitFor(() =>
      expect(screen.getByLabelText(/Te quedan .* para gastar hoy/)).toBeOnTheScreen(),
    );
  });

  it('shows the household, its avatars, the week and the latest movements', async () => {
    await renderHome([
      tx('1', 'income', 200_000, 1, 'Nómina'),
      tx('2', 'expense', 4_200, 13, 'Supermercado'),
    ]);
    await waitFor(() => expect(screen.getByText('Casa')).toBeOnTheScreen());
    expect(screen.getByLabelText('Leo, Ana')).toBeOnTheScreen();
    expect(screen.getByText('ESTA SEMANA')).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /martes: 42,00/ })).toBeOnTheScreen();
    expect(screen.getByText('Supermercado')).toBeOnTheScreen();
    expect(screen.getByText('Nómina')).toBeOnTheScreen();
    expect(screen.getByText('ÚLTIMOS MOVIMIENTOS')).toBeOnTheScreen();
  });

  it('invites to add the first movement when there are none', async () => {
    await renderHome([]);
    await waitFor(() => expect(screen.getByText(/Aún no hay movimientos/)).toBeOnTheScreen());
    expect(screen.getByText(/ya has gastado más de lo que ha entrado/)).toBeOnTheScreen();
  });

  it('does not show a budgets block yet', async () => {
    await renderHome([tx('1', 'income', 200_000, 1, 'Nómina')]);
    await waitFor(() => expect(screen.getByText('DISPONIBLE HOY')).toBeOnTheScreen());
    expect(screen.queryByText(/PRESUPUESTO/i)).toBeNull();
  });
});

import '@testing-library/react-native/matchers';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Money } from '@/core/domain/Money';

import type { CategoryId, Transaction } from '../../../domain/Transaction';
import { ME, createTransactionsTestKit } from '../../../testing/transactionsTestKit';
import { TransactionDetailScreen } from '../TransactionDetailScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockId: string | undefined = 'tx1';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockId = 'tx1';
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

const tx: Transaction = {
  id: 'tx1',
  type: 'expense',
  amount: Money.ofMinor(1_250, 'EUR'),
  categoryId: 'food' as CategoryId,
  description: 'Menú del día',
  occurredAt: new Date(2026, 9, 12),
  householdId: 'h1',
  payerId: ME,
  shared: false,
  shares: [],
};

async function renderDetail(transactions: Transaction[] = [tx]) {
  const kit = createTransactionsTestKit({ memory: { transactions } });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <kit.Wrapper>
        <TransactionDetailScreen />
      </kit.Wrapper>
    </SafeAreaProvider>,
  );
  return kit;
}

describe('TransactionDetailScreen', () => {
  it('shows the movement with its data', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByText('Menú del día')).toBeOnTheScreen());
    expect(screen.getByRole('header', { name: /Gasto de -12,50/ })).toBeOnTheScreen();
    expect(screen.getByText('Comida')).toBeOnTheScreen();
    expect(screen.getByText(/lunes, 12 de octubre/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeOnTheScreen();
  });

  it('explains a movement that no longer exists', async () => {
    await renderDetail([]);
    await waitFor(() => expect(screen.getByText('Este movimiento ya no existe')).toBeOnTheScreen());
  });

  it('goes back with the back button', async () => {
    await renderDetail();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('edits and saves: the new data shows in the reading view', async () => {
    const kit = await renderDetail();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));

    await fireEvent.changeText(screen.getByLabelText('Importe'), '20');
    await fireEvent.changeText(screen.getByLabelText('Nota'), 'Cena');
    await fireEvent.press(screen.getByRole('button', { name: 'Ocio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen());
    expect(screen.getByText('Cena')).toBeOnTheScreen();
    expect(screen.getByText('Ocio')).toBeOnTheScreen();
    expect((await kit.repository.getById('tx1'))?.amount.amountMinor).toBe(2_000);
  });

  it('blocks saving an invalid amount and says why', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
    await fireEvent.changeText(screen.getByLabelText('Importe'), 'abc');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/mayor que cero/);
  });

  it('cancel leaves the edit form', async () => {
    await renderDetail();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen();
  });

  it('steps the day with the arrows but never into the future', async () => {
    await renderDetail([{ ...tx, occurredAt: new Date(2026, 9, 14) }]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Día anterior' }));
    expect(screen.getByText(/martes, 13 de octubre/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeEnabled();
  });

  it('asks before deleting, and deleting goes back', async () => {
    const kit = await renderDetail();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Eliminar' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));

    expect(screen.getByText('¿Eliminar este movimiento?')).toBeOnTheScreen();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeOnTheScreen();
    expect(await kit.repository.getById('tx1')).not.toBeNull(); // not yet

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(await kit.repository.getById('tx1')).toBeNull();
  });

  it('"No, conservar" keeps the movement', async () => {
    const kit = await renderDetail();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Eliminar' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'No, conservar' }));
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
    expect(await kit.repository.getById('tx1')).not.toBeNull();
  });
});

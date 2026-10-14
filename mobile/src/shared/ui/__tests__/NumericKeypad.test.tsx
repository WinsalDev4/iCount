import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { NumericKeypad } from '../NumericKeypad';

const mockSelectionAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...args),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

beforeEach(() => mockSelectionAsync.mockClear());

describe('NumericKeypad', () => {
  it('has the ten digits, the comma and delete', async () => {
    await render(<NumericKeypad onKey={jest.fn()} />);
    for (const digit of '0123456789') {
      expect(screen.getByRole('button', { name: digit })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Coma' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeOnTheScreen();
  });

  it('reports the key that was pressed', async () => {
    const onKey = jest.fn();
    await render(<NumericKeypad onKey={onKey} />);
    await fireEvent.press(screen.getByRole('button', { name: '7' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Coma' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar' }));
    expect(onKey.mock.calls.map(([key]) => key)).toEqual(['7', ',', 'delete']);
  });

  it('gives a tick of haptic feedback on every key', async () => {
    await render(<NumericKeypad onKey={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: '1' }));
    await fireEvent.press(screen.getByRole('button', { name: '2' }));
    expect(mockSelectionAsync).toHaveBeenCalledTimes(2);
  });

  it('can hide the decimal key', async () => {
    await render(<NumericKeypad onKey={jest.fn()} decimal={false} />);
    expect(screen.queryByRole('button', { name: 'Coma' })).toBeNull();
  });

  it('ignores presses when disabled', async () => {
    const onKey = jest.fn();
    await render(<NumericKeypad onKey={onKey} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: '5' }));
    expect(onKey).not.toHaveBeenCalled();
  });

  it('keeps working if the haptic motor fails', async () => {
    mockSelectionAsync.mockRejectedValueOnce(new Error('no vibrator'));
    const onKey = jest.fn();
    await render(<NumericKeypad onKey={onKey} />);
    await fireEvent.press(screen.getByRole('button', { name: '9' }));
    expect(onKey).toHaveBeenCalledWith('9');
  });
});

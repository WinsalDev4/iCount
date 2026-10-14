import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading and reports busy', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" disabled variant="secondary" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders the danger variant and keeps it pressable', async () => {
    const onPress = jest.fn();
    await render(<Button label="Eliminar" variant="danger" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the ghost variant', async () => {
    await render(<Button label="Saltar" variant="ghost" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Saltar' })).toBeEnabled();
  });
});

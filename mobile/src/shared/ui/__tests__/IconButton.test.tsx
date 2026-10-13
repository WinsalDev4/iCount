import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { IconButton } from '../IconButton';
import { theme } from '../theme';

describe('IconButton', () => {
  it('is reachable by its accessibility label and calls onPress', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="back" accessibilityLabel="Atrás" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Atrás' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a touch target of at least 44 pt', async () => {
    await render(<IconButton icon="plus" accessibilityLabel="Añadir" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Añadir' })).toHaveStyle({
      width: theme.minTouch,
      height: theme.minTouch,
    });
  });

  it('ignores presses when disabled', async () => {
    const onPress = jest.fn();
    await render(
      <IconButton
        icon="send"
        accessibilityLabel="Enviar"
        variant="filled"
        disabled
        onPress={onPress}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

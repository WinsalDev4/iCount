import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Chip } from '../Chip';

describe('Chip', () => {
  it('toggles through onPress and exposes the selected state', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Comida" selected onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Comida' });
    expect(chip).toBeSelected();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a static tag without onPress', async () => {
    await render(<Chip label="Fijo" />);
    expect(screen.getByText('Fijo')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

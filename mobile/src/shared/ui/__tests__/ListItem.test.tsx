import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ListItem } from '../ListItem';

describe('ListItem', () => {
  it('renders title, subtitle and trailing text', async () => {
    await render(<ListItem title="Supermercado" subtitle="Comida · hoy" trailing="-54,20 €" />);
    expect(screen.getByText('Supermercado')).toBeOnTheScreen();
    expect(screen.getByText('Comida · hoy')).toBeOnTheScreen();
    expect(screen.getByText('-54,20 €')).toBeOnTheScreen();
  });

  it('becomes a button with a combined label when pressable', async () => {
    const onPress = jest.fn();
    await render(
      <ListItem title="Supermercado" subtitle="Comida" trailing="-54,20 €" onPress={onPress} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Supermercado, Comida, -54,20 €' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not a button without onPress', async () => {
    await render(<ListItem title="Nómina" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

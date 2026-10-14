import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { OptionCard } from '../OptionCard';

describe('OptionCard', () => {
  it('is a radio with its title and description', async () => {
    await render(
      <OptionCard
        title="A partes iguales"
        description="Cada uno lo mismo"
        selected
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'A partes iguales' })).toBeSelected();
    expect(screen.getByText('Cada uno lo mismo')).toBeOnTheScreen();
  });

  it('is not selected by default and reports a press', async () => {
    const onSelect = jest.fn();
    await render(<OptionCard title="Según ingresos" selected={false} onSelect={onSelect} />);
    const radio = screen.getByRole('radio', { name: 'Según ingresos' });
    expect(radio).not.toBeSelected();
    await fireEvent.press(radio);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('when disabled it ignores presses and explains why', async () => {
    const onSelect = jest.fn();
    await render(
      <OptionCard
        title="A medida"
        description="Tú decides"
        disabled
        disabledReason="Disponible cuando se una la otra persona."
        selected={false}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('Disponible cuando se una la otra persona.')).toBeOnTheScreen();
    expect(screen.queryByText('Tú decides')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'A medida' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the description when disabled without a reason', async () => {
    await render(
      <OptionCard
        title="A medida"
        description="Tú decides"
        disabled
        selected={false}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('Tú decides')).toBeOnTheScreen();
  });
});

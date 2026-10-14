import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SwitchRow } from '../SwitchRow';

describe('SwitchRow', () => {
  it('shows label, description and state', async () => {
    await render(
      <SwitchRow
        label="Desbloqueo biométrico"
        description="Huella o Face ID al abrir"
        value
        onValueChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Huella o Face ID al abrir')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Desbloqueo biométrico' })).toBeChecked();
  });

  it('reports the new value', async () => {
    const onValueChange = jest.fn();
    await render(
      <SwitchRow label="Desbloqueo biométrico" value={false} onValueChange={onValueChange} />,
    );
    await fireEvent(
      screen.getByRole('switch', { name: 'Desbloqueo biométrico' }),
      'valueChange',
      true,
    );
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('can be disabled', async () => {
    await render(
      <SwitchRow label="Desbloqueo biométrico" value={false} onValueChange={jest.fn()} disabled />,
    );
    expect(screen.getByRole('switch', { name: 'Desbloqueo biométrico' })).toBeDisabled();
  });
});

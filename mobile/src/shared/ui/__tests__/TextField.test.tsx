import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from '../TextField';

describe('TextField', () => {
  it('is reachable by its label and reports typed text', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Correo electrónico" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'ana@casa.app');
    expect(onChangeText).toHaveBeenCalledWith('ana@casa.app');
  });

  it('shows the error as an alert and exposes it as hint', async () => {
    await render(
      <TextField
        label="Correo electrónico"
        value="x"
        onChangeText={jest.fn()}
        error="Introduce un correo válido"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Introduce un correo válido');
    expect(screen.getByLabelText('Correo electrónico')).toHaveProp(
      'accessibilityHint',
      'Introduce un correo válido',
    );
  });

  it('shows no alert without an error', async () => {
    await render(<TextField label="Correo electrónico" value="" onChangeText={jest.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

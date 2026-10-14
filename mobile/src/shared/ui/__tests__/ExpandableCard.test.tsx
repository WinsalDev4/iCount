import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ExpandableCard } from '../ExpandableCard';

describe('ExpandableCard', () => {
  it('shows only the header while collapsed', async () => {
    await render(
      <ExpandableCard
        title="Solo yo"
        description="Mis cuentas"
        icon="home"
        expanded={false}
        onToggle={jest.fn()}
      >
        <Text>contenido</Text>
      </ExpandableCard>,
    );
    expect(screen.getByRole('button', { name: 'Solo yo' })).not.toBeExpanded();
    expect(screen.getByText('Mis cuentas')).toBeOnTheScreen();
    expect(screen.queryByText('contenido')).toBeNull();
  });

  it('shows the body and announces the expanded state when open', async () => {
    await render(
      <ExpandableCard title="Solo yo" icon="home" expanded onToggle={jest.fn()}>
        <Text>contenido</Text>
      </ExpandableCard>,
    );
    expect(screen.getByRole('button', { name: 'Solo yo' })).toBeExpanded();
    expect(screen.getByText('contenido')).toBeOnTheScreen();
  });

  it('toggles from the header', async () => {
    const onToggle = jest.fn();
    await render(
      <ExpandableCard title="Compartida" icon="users" expanded={false} onToggle={onToggle}>
        <Text>contenido</Text>
      </ExpandableCard>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Compartida' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

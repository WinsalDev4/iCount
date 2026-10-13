import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { GlassCard } from '../GlassCard';
import { theme } from '../theme';

describe('GlassCard', () => {
  it('renders its children on the glass surface', async () => {
    await render(
      <GlassCard testID="card">
        <Text>Contenido</Text>
      </GlassCard>,
    );
    expect(screen.getByText('Contenido')).toBeOnTheScreen();
    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
    });
  });

  it('falls back to the plain surface on Android outside a Screen (no blur target)', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    try {
      await render(
        <GlassCard testID="card">
          <Text>Sin desenfoque</Text>
        </GlassCard>,
      );
      expect(screen.getByText('Sin desenfoque')).toBeOnTheScreen();
      expect(screen.getByTestId('card')).toHaveStyle({ backgroundColor: theme.colors.surface });
    } finally {
      Platform.OS = original;
    }
  });
});

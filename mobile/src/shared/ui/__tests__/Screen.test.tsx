import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen } from '../Screen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen(ui: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
}

describe('Screen', () => {
  it('renders its children over the Midnight Glass background', async () => {
    await renderScreen(
      <Screen>
        <Text>Hola</Text>
      </Screen>,
    );
    expect(screen.getByText('Hola')).toBeOnTheScreen();
  });

  it('applies the safe-area insets by default', async () => {
    await renderScreen(
      <Screen>
        <Text>Contenido</Text>
      </Screen>,
    );
    expect(screen.getByText('Contenido').parent).toHaveStyle({ paddingTop: 47, paddingBottom: 34 });
  });

  it('can opt out of the safe area', async () => {
    await renderScreen(
      <Screen safeArea={false}>
        <Text>Sin área segura</Text>
      </Screen>,
    );
    expect(screen.getByText('Sin área segura').parent).not.toHaveStyle({ paddingTop: 47 });
  });
});

import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabBar, type TabBarItem } from '../TabBar';

const items: readonly TabBarItem[] = [
  { key: 'index', label: 'Inicio', icon: 'home' },
  { key: 'history', label: 'Historial', icon: 'list' },
  { key: 'plan', label: 'Planificar', icon: 'target' },
  { key: 'household', label: 'Hogar', icon: 'users' },
];

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderBar(ui: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
}

describe('TabBar', () => {
  it('shows the four destinations and the add button', async () => {
    await renderBar(
      <TabBar items={items} activeKey="index" onSelect={jest.fn()} onAdd={jest.fn()} />,
    );
    for (const { label } of items) {
      expect(screen.getByRole('tab', { name: label })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Añadir movimiento' })).toBeOnTheScreen();
  });

  it('marks only the active tab as selected', async () => {
    await renderBar(
      <TabBar items={items} activeKey="plan" onSelect={jest.fn()} onAdd={jest.fn()} />,
    );
    expect(screen.getByRole('tab', { name: 'Planificar' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Inicio' })).not.toBeSelected();
  });

  it('reports the tapped destination', async () => {
    const onSelect = jest.fn();
    await renderBar(
      <TabBar items={items} activeKey="index" onSelect={onSelect} onAdd={jest.fn()} />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Hogar' }));
    expect(onSelect).toHaveBeenCalledWith('household');
  });

  it('opens the add flow from the central button, not as a tab', async () => {
    const onAdd = jest.fn();
    const onSelect = jest.fn();
    await renderBar(<TabBar items={items} activeKey="index" onSelect={onSelect} onAdd={onAdd} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir movimiento' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('places the add button between the two halves', async () => {
    await renderBar(
      <TabBar items={items} activeKey="index" onSelect={jest.fn()} onAdd={jest.fn()} />,
    );
    const labels = screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel as string);
    expect(labels).toEqual(['Inicio', 'Historial', 'Planificar', 'Hogar']);
  });
});

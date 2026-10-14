import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';

import { BarChart, type Bar } from '../BarChart';

const bars: Bar[] = [
  { key: 'l', label: 'L', ratio: 1, accessibilityLabel: 'lunes: 20,00 €' },
  { key: 'm', label: 'M', ratio: 0.5, highlighted: true, accessibilityLabel: 'martes: 10,00 €' },
  { key: 'x', label: 'X', ratio: 0, accessibilityLabel: 'miércoles: 0,00 €' },
];

describe('BarChart', () => {
  it('has one labelled bar per entry for screen readers', async () => {
    await render(<BarChart bars={bars} />);
    expect(screen.getByRole('image', { name: 'lunes: 20,00 €' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'martes: 10,00 €' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'miércoles: 0,00 €' })).toBeOnTheScreen();
  });

  it('prints the short labels', async () => {
    await render(<BarChart bars={bars} />);
    for (const label of ['L', 'M', 'X']) expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it('renders without bars', async () => {
    await render(<BarChart bars={[]} />);
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('clamps ratios outside 0..1 and tolerates NaN', async () => {
    await render(
      <BarChart
        bars={[
          { key: 'a', label: 'A', ratio: 7, accessibilityLabel: 'a' },
          { key: 'b', label: 'B', ratio: -2, accessibilityLabel: 'b' },
          { key: 'c', label: 'C', ratio: Number.NaN, accessibilityLabel: 'c' },
        ]}
      />,
    );
    expect(screen.getAllByRole('image')).toHaveLength(3);
  });
});

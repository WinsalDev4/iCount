import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';

import { Donut } from '../Donut';
import { donutArcs } from '../geometry';

describe('donutArcs', () => {
  it('splits the circumference proportionally to the values', () => {
    const arcs = donutArcs(
      [
        { value: 1, color: 'a' },
        { value: 3, color: 'b' },
      ],
      100,
    );
    expect(arcs).toEqual([
      { color: 'a', length: 25, offset: 0 },
      { color: 'b', length: 75, offset: 25 },
    ]);
  });

  it('leaves a gap between slices but not for a single slice', () => {
    const two = donutArcs(
      [
        { value: 1, color: 'a' },
        { value: 1, color: 'b' },
      ],
      100,
      4,
    );
    expect(two.map((arc) => arc.length)).toEqual([46, 46]);
    expect(donutArcs([{ value: 1, color: 'a' }], 100, 4)[0]?.length).toBe(100);
  });

  it('ignores zero, negative and non-finite values', () => {
    const arcs = donutArcs(
      [
        { value: 0, color: 'a' },
        { value: -5, color: 'b' },
        { value: Number.NaN, color: 'c' },
        { value: 2, color: 'd' },
      ],
      100,
    );
    expect(arcs).toEqual([{ color: 'd', length: 100, offset: 0 }]);
  });

  it('returns no arcs when everything is empty', () => {
    expect(donutArcs([], 100)).toEqual([]);
    expect(donutArcs([{ value: 0, color: 'a' }], 100)).toEqual([]);
  });
});

describe('Donut', () => {
  it('is announced as one image with its summary', async () => {
    await render(
      <Donut
        accessibilityLabel="Gasto por categoría"
        slices={[
          { value: 3, color: '#8C7BFF' },
          { value: 1, color: '#3EE6D0' },
        ]}
      />,
    );
    expect(screen.getByRole('image', { name: 'Gasto por categoría' })).toBeOnTheScreen();
  });

  it('renders without slices', async () => {
    await render(<Donut accessibilityLabel="Sin datos" slices={[]} />);
    expect(screen.getByRole('image', { name: 'Sin datos' })).toBeOnTheScreen();
  });
});

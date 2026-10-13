import '@testing-library/react-native/matchers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl } from '../SegmentedControl';

const options = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
] as const;

describe('SegmentedControl', () => {
  it('marks only the current value as selected', async () => {
    await render(
      <SegmentedControl
        accessibilityLabel="Periodo"
        options={options}
        value="month"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Mes' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Semana' })).not.toBeSelected();
  });

  it('reports the tapped value', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        accessibilityLabel="Periodo"
        options={options}
        value="month"
        onChange={onChange}
      />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Semana' }));
    expect(onChange).toHaveBeenCalledWith('week');
  });
});

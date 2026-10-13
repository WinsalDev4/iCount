import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';

import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('exposes the percentage to screen readers', async () => {
    await render(<ProgressBar value={0.62} accessibilityLabel="Ocio" />);
    expect(screen.getByRole('progressbar', { name: 'Ocio' })).toHaveAccessibilityValue({
      min: 0,
      max: 100,
      now: 62,
    });
  });

  it('clamps out-of-range values', async () => {
    await render(<ProgressBar value={1.8} accessibilityLabel="Excedido" />);
    expect(screen.getByRole('progressbar', { name: 'Excedido' })).toHaveAccessibilityValue({
      now: 100,
    });
  });

  it('treats NaN as empty', async () => {
    await render(<ProgressBar value={Number.NaN} accessibilityLabel="Vacío" />);
    expect(screen.getByRole('progressbar', { name: 'Vacío' })).toHaveAccessibilityValue({
      now: 0,
    });
  });
});

import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';

import { AppText } from '../AppText';
import { ProgressRing } from '../ProgressRing';

describe('ProgressRing', () => {
  it('exposes the percentage and renders its center content', async () => {
    await render(
      <ProgressRing value={0.72} accessibilityLabel="Meta de ahorro">
        <AppText>72%</AppText>
      </ProgressRing>,
    );
    expect(screen.getByRole('progressbar', { name: 'Meta de ahorro' })).toHaveAccessibilityValue({
      now: 72,
    });
    expect(screen.getByText('72%')).toBeOnTheScreen();
  });

  it('clamps values above 1', async () => {
    await render(<ProgressRing value={3} accessibilityLabel="Lleno" />);
    expect(screen.getByRole('progressbar', { name: 'Lleno' })).toHaveAccessibilityValue({
      now: 100,
    });
  });
});

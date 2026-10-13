import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';

import { AppText } from '../AppText';
import { theme } from '../theme';

describe('AppText', () => {
  it('renders the variant with Sora and its token size', async () => {
    await render(<AppText variant="displayL">1.534,75 €</AppText>);
    expect(screen.getByText('1.534,75 €')).toHaveStyle({
      fontSize: theme.typography.displayL.fontSize,
      fontFamily: theme.fonts.semibold,
      color: theme.colors.text,
    });
  });

  it('uses the regular weight and the muted tone when asked', async () => {
    await render(
      <AppText variant="small" tone="muted">
        Octubre
      </AppText>,
    );
    expect(screen.getByText('Octubre')).toHaveStyle({
      fontFamily: theme.fonts.regular,
      color: theme.colors.textMuted,
    });
  });

  it('exposes display variants as headers for screen readers', async () => {
    await render(<AppText variant="displayM">Resumen</AppText>);
    expect(screen.getByRole('header', { name: 'Resumen' })).toBeOnTheScreen();
  });
});

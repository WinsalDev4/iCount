import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';

import { Icon, iconNames } from '../Icon';

describe('Icon', () => {
  it('ships the seven icons the app needs', () => {
    expect([...iconNames].sort()).toEqual(
      ['back', 'home', 'list', 'plus', 'send', 'target', 'users'].sort(),
    );
  });

  it.each(iconNames)('renders %s', async (name) => {
    await render(<Icon name={name} accessibilityLabel={`icono ${name}`} />);
    expect(screen.getByRole('image', { name: `icono ${name}` })).toBeOnTheScreen();
  });

  it('is hidden from screen readers without a label', async () => {
    await render(<Icon name="home" />);
    expect(screen.queryByRole('image')).toBeNull();
  });
});

import '@testing-library/react-native/matchers';
import { render, screen } from '@testing-library/react-native';

import { Avatar, AvatarStack, colorFor, initialsOf } from '../Avatar';
import { theme } from '../theme';

describe('initialsOf', () => {
  it('uses the first and last word', () => {
    expect(initialsOf('Ana Ruiz')).toBe('AR');
    expect(initialsOf('  ana maría ruiz ')).toBe('AR');
  });

  it('handles single words and empty names', () => {
    expect(initialsOf('Leo')).toBe('L');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('colorFor', () => {
  it('is stable and comes from the category palette', () => {
    expect(colorFor('Ana Ruiz')).toBe(colorFor('Ana Ruiz'));
    expect(theme.colors.categories).toContain(colorFor('Ana Ruiz'));
  });
});

describe('Avatar', () => {
  it('shows initials and is labelled with the full name', async () => {
    await render(<Avatar name="Ana Ruiz" />);
    expect(screen.getByRole('image', { name: 'Ana Ruiz' })).toBeOnTheScreen();
    expect(screen.getByText('AR')).toBeOnTheScreen();
  });
});

describe('AvatarStack', () => {
  it('collapses the overflow into +N and lists everyone for screen readers', async () => {
    const names = ['Ana Ruiz', 'Leo Marín', 'Carla Soto', 'Dani Vega', 'Eva Gil'];
    await render(<AvatarStack names={names} max={3} />);
    expect(screen.getByText('+2')).toBeOnTheScreen();
    expect(screen.getByLabelText(names.join(', '))).toBeOnTheScreen();
  });

  it('shows no counter when everyone fits', async () => {
    await render(<AvatarStack names={['Ana Ruiz', 'Leo Marín']} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});

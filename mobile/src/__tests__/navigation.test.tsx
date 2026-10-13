import '@testing-library/react-native/matchers';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

/**
 * Renders the real route tree of `src/app` (tabs group + add modal). This also covers the
 * deep links: `icount://history` resolves through the same path → route table.
 *
 * Note: expo-router's own matchers (`toHavePathname`…) are not usable here because its testing
 * helpers call RNTL's `render` synchronously while RNTL v14 made it async. We assert on what
 * the user sees instead (which tab is selected, which screen is shown).
 */
// Resolved from the working directory (jest runs with cwd = mobile/).
const appDir = './src/app';

jest.setTimeout(30_000);

afterEach(() => {
  jest.useRealTimers();
});

describe('navigation', () => {
  it('opens on the Inicio tab', async () => {
    await renderRouter(appDir);
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  it.each([
    ['/history', 'Historial'],
    ['/plan', 'Planificar'],
    ['/household', 'Hogar'],
  ])('deep link %s lands on its tab', async (url, label) => {
    await renderRouter(appDir, { initialUrl: url });
    expect(screen.getByRole('tab', { name: label })).toBeSelected();
    expect(screen.getByRole('header', { name: label })).toBeOnTheScreen();
  });

  it('switches tab when the bar is tapped', async () => {
    await renderRouter(appDir);
    await fireEvent.press(screen.getByRole('tab', { name: 'Planificar' }));
    expect(screen.getByRole('tab', { name: 'Planificar' })).toBeSelected();
    expect(screen.getByRole('header', { name: 'Planificar' })).toBeOnTheScreen();
  });

  it('opens the add modal from the central button and closes it again', async () => {
    await renderRouter(appDir);
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir movimiento' }));
    expect(screen.getByRole('header', { name: 'Añadir movimiento' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    await act(async () => {});
    expect(screen.queryByRole('header', { name: 'Añadir movimiento' })).toBeNull();
  });

  it('deep link /add opens the modal directly', async () => {
    await renderRouter(appDir, { initialUrl: '/add' });
    expect(screen.getByRole('header', { name: 'Añadir movimiento' })).toBeOnTheScreen();
  });
});

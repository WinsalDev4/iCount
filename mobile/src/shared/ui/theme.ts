/** Placeholder tokens until a design direction is chosen (see docs/design). */
export const theme = {
  colors: {
    background: '#0B0B0F',
    surface: '#16161D',
    text: '#F5F5F7',
    textMuted: '#9A9AA5',
    income: '#3DDC97',
    expense: '#FF5C7A',
    accent: '#7C5CFF',
  },
  spacing: (n: number) => n * 4,
  radius: { md: 12, lg: 20 },
} as const;

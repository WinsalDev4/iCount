/**
 * Design tokens — "Midnight Glass" direction.
 * Decision and rationale: docs/adr/0009-direccion-visual-midnight-glass.md
 * Visual reference (proposal 02 on every page): docs/design/README.md
 */
const categoryColors = ['#8C7BFF', '#3EE6D0', '#FF7AC6', '#FFC46B', '#5B6CFF'] as const;

export const theme = {
  colors: {
    background: '#0B0C1A',
    surface: 'rgba(255,255,255,0.07)',
    surfaceBorder: 'rgba(255,255,255,0.12)',
    chip: 'rgba(255,255,255,0.08)',
    field: 'rgba(255,255,255,0.06)',
    track: 'rgba(255,255,255,0.10)',
    text: '#F2F1FF',
    textMuted: '#A9A8C8',
    accent: '#8C7BFF',
    onAccent: '#0B0C1A',
    accentSecondary: '#3EE6D0',
    income: '#4BE3A3',
    expense: '#FF7A93',
    /** Background radial glows: top-left violet, right-middle teal. */
    glowPrimary: 'rgba(140,123,255,0.38)',
    glowSecondary: 'rgba(62,230,208,0.20)',
    categories: categoryColors,
  },
  typography: {
    displayXxl: { fontSize: 56, letterSpacing: -1.7, fontWeight: '600' },
    displayXl: { fontSize: 42, letterSpacing: -1.3, fontWeight: '600' },
    displayL: { fontSize: 30, letterSpacing: -0.9, fontWeight: '600' },
    displayM: { fontSize: 22, letterSpacing: -0.6, fontWeight: '600' },
    body: { fontSize: 15, letterSpacing: 0, fontWeight: '400' },
    small: { fontSize: 13, letterSpacing: 0, fontWeight: '400' },
    label: { fontSize: 12, letterSpacing: 0, fontWeight: '700' },
  },
  /** Sora faces loaded in app/_layout.tsx. One family per weight: Android ignores fontWeight on custom fonts. */
  fonts: {
    regular: 'Sora_400Regular',
    semibold: 'Sora_600SemiBold',
    bold: 'Sora_700Bold',
  },
  /** Minimum touch target (pt) for anything pressable. */
  minTouch: 44,
  spacing: (n: number) => n * 4,
  radius: { sm: 14, md: 18, lg: 22, pill: 999 },
  /** Intensity for expo-blur BlurView on glass surfaces. */
  blur: 18,
} as const;

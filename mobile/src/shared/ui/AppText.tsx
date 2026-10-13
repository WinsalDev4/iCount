import { Text, type TextProps } from 'react-native';

import { theme } from './theme';

export type TextVariant = keyof typeof theme.typography;
export type TextTone = 'text' | 'muted' | 'accent' | 'onAccent' | 'income' | 'expense';

const toneColor: Record<TextTone, string> = {
  text: theme.colors.text,
  muted: theme.colors.textMuted,
  accent: theme.colors.accent,
  onAccent: theme.colors.onAccent,
  income: theme.colors.income,
  expense: theme.colors.expense,
};

function fontFor(weight: string): string {
  if (weight === '700') return theme.fonts.bold;
  if (weight === '600') return theme.fonts.semibold;
  return theme.fonts.regular;
}

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

/** Typography entry point: Sora with the sizes of `theme.typography`. */
export function AppText({ variant = 'body', tone = 'text', style, ...props }: AppTextProps) {
  const { fontSize, letterSpacing, fontWeight } = theme.typography[variant];
  return (
    <Text
      accessibilityRole={variant.startsWith('display') ? 'header' : undefined}
      {...props}
      style={[
        { fontSize, letterSpacing, fontFamily: fontFor(fontWeight), color: toneColor[tone] },
        style,
      ]}
    />
  );
}

import { StyleSheet, View } from 'react-native';

import { clamp01 } from './geometry';
import { theme } from './theme';

export type ProgressBarProps = {
  /** 0..1. Values outside the range are clamped. */
  value: number;
  color?: string;
  accessibilityLabel: string;
};

export function ProgressBar({
  value,
  color = theme.colors.accent,
  accessibilityLabel,
}: ProgressBarProps) {
  const ratio = clamp01(value);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.track,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: theme.radius.pill },
});

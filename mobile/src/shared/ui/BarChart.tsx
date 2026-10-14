import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { clamp01 } from './geometry';
import { theme } from './theme';

export type Bar = {
  key: string;
  /** Short label under the bar ("L", "M"…). */
  label: string;
  /** 0..1 of the chart height. Anything non-zero is drawn at least a few points tall. */
  ratio: number;
  highlighted?: boolean;
  /** Read by screen readers instead of the bare bar: "lunes: 12,00 €". */
  accessibilityLabel: string;
};

export type BarChartProps = {
  bars: readonly Bar[];
  /** Height of the plot area (without labels). */
  height?: number;
};

const MIN_VISIBLE = 4;

/** Plain vertical bars (a week of spending…). Drawn with Views: no SVG needed for rectangles. */
export function BarChart({ bars, height = 96 }: BarChartProps) {
  return (
    <View style={styles.row}>
      {bars.map((bar) => {
        const ratio = clamp01(bar.ratio);
        const barHeight = ratio === 0 ? 0 : Math.max(MIN_VISIBLE, Math.round(ratio * height));
        return (
          <View
            key={bar.key}
            accessible
            accessibilityRole="image"
            accessibilityLabel={bar.accessibilityLabel}
            style={styles.column}
          >
            <View style={[styles.plot, { height }]}>
              <View style={[styles.track, { height }]} />
              <View
                style={[
                  styles.bar,
                  { height: barHeight },
                  bar.highlighted ? styles.barHighlighted : styles.barNormal,
                ]}
              />
            </View>
            <AppText
              variant="label"
              tone={bar.highlighted ? 'accent' : 'muted'}
              importantForAccessibility="no"
            >
              {bar.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing(2) },
  column: { flex: 1, alignItems: 'center', gap: theme.spacing(1) },
  plot: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  track: {
    position: 'absolute',
    bottom: 0,
    width: '60%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.track,
  },
  bar: { width: '60%', borderRadius: theme.radius.pill },
  barNormal: { backgroundColor: theme.colors.textMuted },
  barHighlighted: { backgroundColor: theme.colors.accent },
});

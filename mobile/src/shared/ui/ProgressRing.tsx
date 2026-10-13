import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { clamp01 } from './geometry';
import { theme } from './theme';

export type ProgressRingProps = {
  /** 0..1. Values outside the range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  accessibilityLabel: string;
  /** Centered content (e.g. a percentage). */
  children?: ReactNode;
};

export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 10,
  color = theme.colors.accent,
  accessibilityLabel,
  children,
}: ProgressRingProps) {
  const ratio = clamp01(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
          fill="none"
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

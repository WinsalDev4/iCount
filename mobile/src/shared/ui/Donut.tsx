import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { donutArcs, type DonutSlice } from './geometry';
import { theme } from './theme';

export type DonutProps = {
  /** Proportional weights (not money). The component normalises them to the full ring. */
  slices: readonly DonutSlice[];
  size?: number;
  strokeWidth?: number;
  /** Summary read by screen readers, e.g. "Gasto por categoría". */
  accessibilityLabel: string;
  /** Centered content (e.g. the balance). */
  children?: ReactNode;
};

export function Donut({
  slices,
  size = 160,
  strokeWidth = 18,
  accessibilityLabel,
  children,
}: DonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcs = donutArcs(slices, circumference, strokeWidth * 0.25);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
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
        {arcs.map((arc, index) => (
          <Circle
            key={`${arc.color}-${index}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arc.length} ${circumference}`}
            strokeDashoffset={-arc.offset}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
            fill="none"
          />
        ))}
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

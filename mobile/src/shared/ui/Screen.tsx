import { BlurTargetView } from 'expo-blur';
import { useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurTargetContext } from './blurTarget';
import { theme } from './theme';

export type Edge = 'top' | 'bottom' | 'left' | 'right';

export type ScreenProps = {
  children: ReactNode;
  /** Apply the safe-area padding (default). Turn off when a navigator already does it. */
  safeArea?: boolean;
  /** Which safe-area edges to pad while `safeArea` is on. Screens inside tabs leave out 'bottom'. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
};

const allEdges: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

/** Midnight Glass backdrop: near-black base plus a violet and a teal radial glow. */
function Glows() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient
          id="glowPrimary"
          cx="10%"
          cy="6%"
          rx="75%"
          ry="45%"
          gradientUnits="objectBoundingBox"
        >
          <Stop offset="0" stopColor={theme.colors.glowPrimary} />
          <Stop offset="1" stopColor={theme.colors.glowPrimary} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient
          id="glowSecondary"
          cx="95%"
          cy="45%"
          rx="65%"
          ry="38%"
          gradientUnits="objectBoundingBox"
        >
          <Stop offset="0" stopColor={theme.colors.glowSecondary} />
          <Stop offset="1" stopColor={theme.colors.glowSecondary} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#glowPrimary)" />
      <Rect width="100%" height="100%" fill="url(#glowSecondary)" />
    </Svg>
  );
}

export function Screen({ children, safeArea = true, edges = allEdges, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View | null>(null);

  return (
    <BlurTargetContext.Provider value={blurTarget}>
      <View style={styles.root}>
        <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
          <Glows />
        </BlurTargetView>
        <View
          style={[
            styles.content,
            safeArea && {
              paddingTop: edges.includes('top') ? insets.top : 0,
              paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
              paddingLeft: edges.includes('left') ? insets.left : 0,
              paddingRight: edges.includes('right') ? insets.right : 0,
            },
            style,
          ]}
        >
          {children}
        </View>
      </View>
    </BlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1 },
});

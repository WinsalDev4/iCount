import { BlurView } from 'expo-blur';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { useBlurTarget } from './blurTarget';
import { theme } from './theme';

export type GlassCardProps = ViewProps & {
  /** Padding in spacing units (×4 pt). Default 4 = 16 pt. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Translucent glass surface. iOS blurs whatever is behind it; Android needs the
 * `BlurTargetView` that `Screen` provides. Outside a `Screen` it degrades to the plain
 * semi-transparent surface (and expo-blur itself falls back on Android < 12): still readable,
 * just not blurred.
 */
export function GlassCard({ padding = 4, style, children, ...props }: GlassCardProps) {
  const blurTarget = useBlurTarget();
  const canBlur = Platform.OS !== 'android' || blurTarget !== null;

  return (
    <View {...props} style={[styles.card, { padding: theme.spacing(padding) }, style]}>
      {canBlur ? (
        <BlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint="dark"
          intensity={theme.blur}
          blurTarget={blurTarget ?? undefined}
          blurMethod="dimezisBlurViewSdk31Plus"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
});

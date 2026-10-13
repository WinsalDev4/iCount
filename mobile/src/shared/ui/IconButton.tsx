import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from './Icon';
import { theme } from './theme';

export type IconButtonProps = {
  icon: IconName;
  /** Required: an icon-only button has no other text for screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  /** `filled` is the accent FAB-style button; `glass` the translucent one. */
  variant?: 'glass' | 'filled';
  disabled?: boolean;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'glass',
  disabled = false,
}: IconButtonProps) {
  const filled = variant === 'filled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        filled ? styles.filled : styles.glass,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={22} color={filled ? theme.colors.onAccent : theme.colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: theme.minTouch,
    height: theme.minTouch,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glass: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filled: { backgroundColor: theme.colors.accent },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});

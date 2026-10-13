import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { theme } from './theme';

export type ChipProps = {
  label: string;
  /** Without `onPress` the chip is a static tag. */
  onPress?: () => void;
  selected?: boolean;
};

export function Chip({ label, onPress, selected = false }: ChipProps) {
  const body = (
    <View style={[styles.chip, selected && styles.selected]}>
      <AppText variant="small" tone={selected ? 'onAccent' : 'text'} style={styles.label}>
        {label}
      </AppText>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.touch}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** The visual pill is 32 pt tall; the pressable wrapper keeps the 44 pt touch target. */
  touch: { minHeight: theme.minTouch, justifyContent: 'center' },
  chip: {
    height: 32,
    paddingHorizontal: theme.spacing(3.5),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: theme.colors.accent },
  label: { fontFamily: theme.fonts.semibold },
});

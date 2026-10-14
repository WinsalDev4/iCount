import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { theme } from './theme';

export type OptionCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Why it is disabled, shown instead of the description. */
  disabledReason?: string;
};

/** One choice of a single-choice group (radio): a card with a title and a short explanation. */
export function OptionCard({
  title,
  description,
  selected,
  onSelect,
  disabled = false,
  disabledReason,
}: OptionCardProps) {
  const detail = disabled && disabledReason ? disabledReason : description;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.texts}>
        <AppText style={styles.title}>{title}</AppText>
        {detail ? (
          <AppText variant="small" tone="muted">
            {detail}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.field,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surface },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: theme.colors.accent },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.accent },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: theme.fonts.semibold },
});

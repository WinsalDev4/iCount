import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from './AppText';
import { theme } from './theme';

export type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** Label + optional description on the left, a native switch on the right (≥ 44 pt row). */
export function SwitchRow({ label, description, value, onValueChange, disabled }: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <AppText style={styles.label}>{label}</AppText>
        {description ? (
          <AppText variant="small" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.track, true: theme.colors.accent }}
        thumbColor={theme.colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.minTouch + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
  },
  texts: { flex: 1, gap: 2 },
  label: { fontFamily: theme.fonts.semibold },
});

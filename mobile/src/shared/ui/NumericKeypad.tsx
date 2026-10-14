import { Pressable, StyleSheet, View } from 'react-native';

import { tapHaptic } from '../haptics';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { theme } from './theme';

export type NumericKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'delete';

export type NumericKeypadProps = {
  onKey: (key: NumericKey) => void;
  /** The decimal key can be hidden for whole-number entry. */
  decimal?: boolean;
  disabled?: boolean;
};

const rows: readonly (readonly (NumericKey | null)[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', 'delete'],
];

const spoken: Partial<Record<NumericKey, string>> = { ',': 'Coma', delete: 'Borrar' };

/** Our own 3×4 keypad (the system keyboard would cover half the screen) with a tick per key. */
export function NumericKeypad({ onKey, decimal = true, disabled = false }: NumericKeypadProps) {
  return (
    <View style={styles.pad} accessibilityLabel="Teclado numérico">
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((key) =>
            key === null || (key === ',' && !decimal) ? (
              <View key={`${index}-${key}`} style={styles.key} />
            ) : (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={spoken[key] ?? key}
                disabled={disabled}
                onPress={() => {
                  tapHaptic();
                  onKey(key);
                }}
                style={({ pressed }) => [styles.key, styles.button, pressed && styles.pressed]}
              >
                {key === 'delete' ? (
                  <Icon name="back" size={24} />
                ) : (
                  <AppText variant="displayM">{key}</AppText>
                )}
              </Pressable>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: theme.spacing(2) },
  row: { flexDirection: 'row', gap: theme.spacing(2) },
  key: { flex: 1, minHeight: 56 },
  button: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: theme.colors.chip },
});

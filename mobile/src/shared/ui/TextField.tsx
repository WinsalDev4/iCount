import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from './AppText';
import { theme } from './theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Visible label, also the accessibility label of the input. */
  label: string;
  /** Validation or server message; turns the border red and is announced with the field. */
  error?: string | null;
};

/** Glass text input with a label above and an error line below. */
export function TextField({ label, error, accessibilityLabel, ...props }: TextFieldProps) {
  const hasError = Boolean(error);
  return (
    <View style={styles.wrapper}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error ?? props.accessibilityHint}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.accent}
        style={[styles.input, hasError && styles.inputError]}
      />
      {hasError ? (
        <AppText variant="small" tone="expense" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing(2) },
  input: {
    minHeight: 52,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.field,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: StyleSheet.hairlineWidth,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: theme.typography.body.fontSize,
  },
  inputError: { borderColor: theme.colors.expense },
});

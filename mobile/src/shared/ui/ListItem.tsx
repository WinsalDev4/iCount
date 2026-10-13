import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, type TextTone } from './AppText';
import { theme } from './theme';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Left slot: Avatar, Icon… */
  leading?: ReactNode;
  /** Right slot: a string is rendered as text, anything else as-is. */
  trailing?: ReactNode;
  trailingTone?: TextTone;
  /** Without `onPress` the row is static. */
  onPress?: () => void;
};

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  trailingTone = 'text',
  onPress,
}: ListItemProps) {
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.texts}>
        <AppText variant="body" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {typeof trailing === 'string' ? (
        <AppText variant="body" tone={trailingTone} style={styles.title}>
          {trailing}
        </AppText>
      ) : (
        trailing
      )}
    </>
  );

  if (!onPress) {
    return (
      <View accessible style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, typeof trailing === 'string' ? trailing : undefined]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    paddingVertical: theme.spacing(2),
  },
  leading: { alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
  title: { fontFamily: theme.fonts.semibold },
  pressed: { opacity: 0.7 },
});

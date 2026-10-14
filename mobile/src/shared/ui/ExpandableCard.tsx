import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';
import { theme } from './theme';

export type ExpandableCardProps = {
  title: string;
  description?: string;
  icon: IconName;
  expanded: boolean;
  onToggle: () => void;
  /** Shown only while expanded. */
  children: ReactNode;
};

/**
 * Accordion card: a header that always shows and a body that opens under it. Only the header is
 * pressable, and it announces its expanded state to screen readers.
 */
export function ExpandableCard({
  title,
  description,
  icon,
  expanded,
  onToggle,
  children,
}: ExpandableCardProps) {
  return (
    <GlassCard padding={0} style={expanded ? styles.cardOpen : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={description}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.iconBox}>
          <Icon name={icon} size={22} color={theme.colors.accent} />
        </View>
        <View style={styles.texts}>
          <AppText style={styles.title}>{title}</AppText>
          {description ? (
            <AppText variant="small" tone="muted">
              {description}
            </AppText>
          ) : null}
        </View>
        {/* The "back" chevron points left; turned it points down (open) or right (closed). */}
        <View style={{ transform: [{ rotate: expanded ? '-90deg' : '180deg' }] }}>
          <Icon name="back" size={20} color={theme.colors.textMuted} />
        </View>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  cardOpen: { borderColor: theme.colors.accent },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
  },
  pressed: { opacity: 0.8 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: theme.fonts.semibold },
  body: { gap: theme.spacing(4), padding: theme.spacing(4), paddingTop: 0 },
});

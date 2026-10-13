import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';
import { theme } from './theme';

export type TabBarItem = { key: string; label: string; icon: IconName };

export type TabBarProps = {
  /** Four destinations: the first half goes left of the "+" button, the rest right. */
  items: readonly TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onAdd: () => void;
  addLabel?: string;
};

const FAB_SIZE = 56;

/**
 * Glass bottom bar with a central "+" button. Purely presentational: it knows nothing about
 * Expo Router (the adapter lives in `app/(tabs)/_layout.tsx`), so it is easy to test and reuse.
 */
export function TabBar({
  items,
  activeKey,
  onSelect,
  onAdd,
  addLabel = 'Añadir movimiento',
}: TabBarProps) {
  const insets = useSafeAreaInsets();
  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);

  const renderItem = (item: TabBarItem) => {
    const selected = item.key === activeKey;
    const color = selected ? theme.colors.accent : theme.colors.textMuted;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        onPress={() => onSelect(item.key)}
        style={styles.tab}
      >
        <Icon name={item.icon} size={22} color={color} />
        <AppText variant="label" style={{ color, fontFamily: theme.fonts.semibold, fontSize: 11 }}>
          {item.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, theme.spacing(2)) }]}>
      <View style={styles.bar}>
        {/* Glass is a background layer, not the parent: GlassCard clips, and the FAB must overflow. */}
        <GlassCard padding={0} pointerEvents="none" style={StyleSheet.absoluteFill} />
        <View accessibilityRole="tablist" style={styles.row}>
          {left.map(renderItem)}
          <View style={styles.fabSlot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              onPress={onAdd}
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            >
              <Icon name="plus" size={26} color={theme.colors.onAccent} strokeWidth={2.4} />
            </Pressable>
          </View>
          {right.map(renderItem)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(2) },
  bar: { borderRadius: theme.radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  tab: {
    flex: 1,
    minHeight: theme.minTouch + 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  /** The FAB overflows the bar upwards; the slot keeps the row width. */
  fabSlot: { width: FAB_SIZE + theme.spacing(4), alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -theme.spacing(5),
    borderWidth: 4,
    borderColor: theme.colors.background,
  },
  pressed: { opacity: 0.85 },
});

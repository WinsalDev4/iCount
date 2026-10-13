import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { theme } from './theme';

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Stable color per person: the same name always gets the same category color. */
export function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const palette = theme.colors.categories;
  return palette[hash % palette.length] ?? theme.colors.accent;
}

export type AvatarProps = {
  name: string;
  size?: number;
  color?: string;
};

export function Avatar({ name, size = 40, color }: AvatarProps) {
  const background = color ?? colorFor(name);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}
    >
      <AppText
        variant="small"
        tone="onAccent"
        style={{ fontFamily: theme.fonts.bold, fontSize: Math.round(size * 0.36) }}
      >
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

export type AvatarStackProps = {
  names: readonly string[];
  size?: number;
  /** Avatars shown before collapsing the rest into "+N". */
  max?: number;
};

export function AvatarStack({ names, size = 32, max = 4 }: AvatarStackProps) {
  const visible = names.slice(0, max);
  const hidden = names.length - visible.length;
  const overlap = -Math.round(size * 0.3);

  return (
    <View accessible accessibilityLabel={names.join(', ')} style={styles.row}>
      {visible.map((name, index) => (
        <View
          key={`${name}-${index}`}
          style={[
            styles.ring,
            { borderRadius: (size + 4) / 2, marginLeft: index === 0 ? 0 : overlap },
          ]}
        >
          <Avatar name={name} size={size} />
        </View>
      ))}
      {hidden > 0 ? (
        <View
          style={[
            styles.circle,
            styles.more,
            { width: size, height: size, borderRadius: size / 2, marginLeft: overlap },
          ]}
        >
          <AppText variant="label">+{hidden}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  /** Background-colored ring that separates overlapping avatars. */
  ring: { padding: 2, backgroundColor: theme.colors.background },
  more: { backgroundColor: theme.colors.chip },
});

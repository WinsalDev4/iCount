import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';
import { Screen, type Edge } from './Screen';
import { theme } from './theme';

export type PlaceholderScreenProps = {
  title: string;
  description: string;
  icon: IconName;
  edges?: readonly Edge[];
};

/** Stand-in for a screen that lands in a later task. Replace the route, not this component. */
export function PlaceholderScreen({ title, description, icon, edges }: PlaceholderScreenProps) {
  return (
    <Screen edges={edges}>
      <View style={styles.content}>
        <AppText variant="displayL">{title}</AppText>
        <GlassCard style={styles.card}>
          <Icon name={icon} size={32} color={theme.colors.accent} />
          <AppText tone="muted">{description}</AppText>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: theme.spacing(5), gap: theme.spacing(5) },
  card: { gap: theme.spacing(3) },
});

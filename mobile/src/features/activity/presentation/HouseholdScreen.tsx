import { ScrollView, StyleSheet, View } from 'react-native';

import { AccountCard } from '@/features/auth/presentation/AccountCard';
import { MembersSection } from '@/features/household/presentation/MembersSection';
import { useActiveHousehold } from '@/features/household/presentation/households';
import { BalanceCard } from '@/features/settlements/presentation/BalanceCard';
import { AppText } from '@/shared/ui/AppText';
import { GlassCard } from '@/shared/ui/GlassCard';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { ActivityFeed } from './ActivityFeed';

/**
 * Tab Hogar (screen 09): the balance on top, the activity below and the members. A household of
 * one person has no balance or approvals to show: it invites to add somebody instead.
 */
export function HouseholdScreen() {
  const household = useActiveHousehold();
  const shared = (household?.members.length ?? 0) > 1;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <AppText variant="displayL" accessibilityRole="header">
            Hogar
          </AppText>
          {household ? <AppText tone="muted">{household.name}</AppText> : null}
        </View>

        {shared ? (
          <>
            <BalanceCard />
            <AppText variant="label" tone="muted" accessibilityRole="header">
              ACTIVIDAD
            </AppText>
            <ActivityFeed />
          </>
        ) : (
          <GlassCard style={styles.alone}>
            <AppText>Ahora mismo estás tú solo en este hogar.</AppText>
            <AppText tone="muted">
              Invita a alguien y aquí verás quién debe a quién, los gastos por aprobar y los
              comentarios.
            </AppText>
          </GlassCard>
        )}

        <MembersSection />
        <AccountCard />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing(5), gap: theme.spacing(4) },
  alone: { gap: theme.spacing(2) },
});

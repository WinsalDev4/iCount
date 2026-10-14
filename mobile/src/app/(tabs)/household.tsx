import { View } from 'react-native';

import { AccountCard } from '@/features/auth/presentation/AccountCard';
import { AppText } from '@/shared/ui/AppText';
import { GlassCard } from '@/shared/ui/GlassCard';
import { Icon } from '@/shared/ui/Icon';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

/** Provisional: B-5.1 replaces this with the shared household. The account card stays reachable. */
export default function HouseholdRoute() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, padding: theme.spacing(5), gap: theme.spacing(5) }}>
        <AppText variant="displayL">Hogar</AppText>
        <GlassCard style={{ gap: theme.spacing(3) }}>
          <Icon name="users" size={32} color={theme.colors.accent} />
          <AppText tone="muted">Balance entre miembros y actividad compartida.</AppText>
        </GlassCard>
        <AccountCard />
      </View>
    </Screen>
  );
}

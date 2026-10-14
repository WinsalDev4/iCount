import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import type { HouseholdId } from '@/core/domain/Ids';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useInviteViewModel } from './useInviteViewModel';

/** Step 2 of a shared household: the code to send to the other people. */
export function InviteScreen() {
  const { householdId } = useLocalSearchParams<{ householdId?: string }>();
  const { state, householdName, renew } = useInviteViewModel(
    householdId as HouseholdId | undefined,
  );
  const router = useRouter();

  const share = async () => {
    if (state.status !== 'ready') return;
    // Native share sheet (WhatsApp, Mail, Messages…). Cancelling it is not an error.
    await Share.share({ message: state.shareMessage });
  };

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.hero}>
          <AppText variant="displayXl">Invita a tu gente</AppText>
          <AppText tone="muted">
            Comparte este código con quien vaya a entrar en «{householdName}». Sirve una sola vez.
          </AppText>
        </View>

        <GlassCard style={styles.codeCard}>
          {state.status === 'loading' ? <ActivityIndicator color={theme.colors.accent} /> : null}
          {state.status === 'error' ? (
            <>
              <AppText tone="expense" accessibilityRole="alert">
                {state.message}
              </AppText>
              <Button label="Reintentar" variant="secondary" onPress={() => void renew()} />
            </>
          ) : null}
          {state.status === 'ready' ? (
            <>
              <AppText
                variant="displayXl"
                tone="accent"
                accessibilityLabel={`Código ${state.code}`}
              >
                {state.code}
              </AppText>
              <AppText variant="small" tone="muted">
                Caduca el {state.expiresOn}
              </AppText>
            </>
          ) : null}
        </GlassCard>

        <View style={styles.actions}>
          <Button
            label="Compartir código"
            onPress={() => void share()}
            disabled={state.status !== 'ready'}
          />
          <Button
            label="Continuar"
            variant="secondary"
            onPress={() => router.push({ pathname: '/split', params: { householdId } })}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: theme.spacing(6), gap: theme.spacing(6) },
  hero: { gap: theme.spacing(2) },
  codeCard: {
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: 120,
    justifyContent: 'center',
  },
  actions: { gap: theme.spacing(2) },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { env } from '@/core/config/env';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { Icon } from '@/shared/ui/Icon';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useCheckEmailViewModel } from './useCheckEmailViewModel';

/** "Revisa tu correo": waits for the person to open the link in their mail app. */
export function CheckEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { state, resend } = useCheckEmailViewModel(params.email ?? '');

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Icon name="send" size={40} color={theme.colors.accent} />
          <AppText variant="displayXl">Revisa tu correo</AppText>
          <AppText tone="muted">
            Hemos enviado un enlace a <AppText style={styles.email}>{state.email}</AppText>. Ábrelo
            en este dispositivo y entrarás directamente. Caduca en 15 minutos.
          </AppText>
        </View>

        {state.error ? (
          <AppText tone="expense" accessibilityRole="alert">
            {state.error}
          </AppText>
        ) : null}
        {state.resent && !state.error ? (
          <AppText tone="income" accessibilityLiveRegion="polite">
            Enlace enviado de nuevo.
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={state.canResend ? 'Reenviar el enlace' : `Reenviar en ${state.secondsLeft} s`}
            variant="secondary"
            onPress={() => void resend()}
            disabled={!state.canResend}
            loading={state.sending}
          />
          <Button label="Usar otro correo" variant="ghost" onPress={() => router.back()} />
        </View>

        {/* Memory mode has no email: this shortcut plays the part of tapping the link. */}
        {__DEV__ && env.dataSource === 'memory' ? (
          <GlassCard style={styles.devCard}>
            <AppText variant="small" tone="muted">
              Modo memoria: no se envía ningún correo.
            </AppText>
            <Button
              label="Simular que abro el enlace"
              variant="secondary"
              onPress={() => router.push({ pathname: '/auth/verify', params: { token: 'dev' } })}
            />
          </GlassCard>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing(6),
    gap: theme.spacing(6),
  },
  hero: { gap: theme.spacing(3) },
  email: { fontFamily: theme.fonts.semibold },
  actions: { gap: theme.spacing(2) },
  devCard: { gap: theme.spacing(3) },
});

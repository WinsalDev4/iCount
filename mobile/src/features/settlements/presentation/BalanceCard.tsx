import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { theme } from '@/shared/ui/theme';

import { useBalanceViewModel } from './useBalanceViewModel';

/** Balance header of the Hogar tab (screen 09-A): who owes whom and the way to settle. */
export function BalanceCard() {
  const { state, refresh } = useBalanceViewModel();
  const router = useRouter();

  if (state.status === 'loading') {
    return (
      <GlassCard style={styles.card}>
        <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Cargando balance" />
      </GlassCard>
    );
  }
  if (state.status === 'error') {
    return (
      <GlassCard style={styles.card}>
        <AppText tone="muted" accessibilityRole="alert">
          {state.message}
        </AppText>
        <Button label="Reintentar" variant="secondary" onPress={() => void refresh()} />
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.card}>
      <AppText variant="label" tone="muted">
        BALANCE
      </AppText>
      <AppText
        variant="displayXl"
        tone={state.tone === 'neutral' ? 'text' : state.tone}
        accessibilityRole="header"
      >
        {state.headline}
      </AppText>
      <View accessible accessibilityLabel={state.lines.join('. ')} style={styles.lines}>
        {state.lines.length === 0 ? (
          <AppText tone="muted">No hay deudas entre vosotros.</AppText>
        ) : (
          state.lines.map((line) => <AppText key={line}>{line}</AppText>)
        )}
      </View>
      {state.pendingNote ? (
        <AppText variant="small" tone="muted">
          {state.pendingNote}
        </AppText>
      ) : null}
      {state.canSettle ? (
        <Button label="Saldar cuentas" onPress={() => router.push('/settle')} />
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.spacing(2) },
  lines: { gap: theme.spacing(1) },
});

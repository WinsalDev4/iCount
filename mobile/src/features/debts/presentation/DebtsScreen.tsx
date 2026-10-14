import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useDebtsViewModel } from './useDebtsViewModel';

/** Deudas (screen 08): what you owe in total and one card per debt with its progress. */
export function DebtsScreen() {
  const { state, refresh } = useDebtsViewModel();
  const router = useRouter();

  const topBar = (
    <View style={styles.topBar}>
      <IconButton
        icon="back"
        accessibilityLabel="Volver"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/plan'))}
      />
      <AppText variant="displayM" accessibilityRole="header">
        Deudas
      </AppText>
      <View style={styles.spacer} />
    </View>
  );

  if (state.status === 'loading') {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Cargando" />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <AppText tone="muted" accessibilityRole="alert">
            {state.message}
          </AppText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refresh()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {topBar}
      <ScrollView contentContainerStyle={styles.content}>
        <View
          accessible
          accessibilityLabel={`Debes ${state.totalOutstanding} en total, con ${state.totalMonthly} de cuotas al mes`}
          style={styles.hero}
        >
          <AppText variant="label" tone="muted">
            PENDIENTE DE PAGAR
          </AppText>
          <AppText variant="displayXl" tone={state.aliveCount > 0 ? 'text' : 'income'}>
            {state.totalOutstanding}
          </AppText>
          <AppText tone="muted">
            {state.aliveCount === 0
              ? 'No debes nada. ¡Enhorabuena!'
              : `${state.totalMonthly} al mes en ${state.aliveCount} ${state.aliveCount === 1 ? 'deuda' : 'deudas'}`}
          </AppText>
        </View>

        {state.rows.length === 0 ? (
          <AppText tone="muted" style={styles.empty}>
            Aún no has registrado deudas. Añade una para ver cuándo la terminas.
          </AppText>
        ) : (
          state.rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`${row.name}, ${row.outstanding} pendientes`}
              onPress={() => router.push({ pathname: '/debts/[id]', params: { id: row.id } })}
            >
              <GlassCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitle}>
                    <AppText style={styles.strong}>{row.name}</AppText>
                    <AppText variant="small" tone="muted">
                      {row.kindLabel} · {row.rate}
                    </AppText>
                  </View>
                  <AppText style={styles.strong}>{row.outstanding}</AppText>
                </View>
                <ProgressBar
                  value={row.paidRatio}
                  color={row.paidOff ? theme.colors.income : theme.colors.accent}
                  accessibilityLabel={`${row.name}: ${row.paidPercent} % pagado`}
                />
                <AppText variant="small" tone="muted">
                  {row.paidPercent} % pagado · {row.nextPayment}
                </AppText>
              </GlassCard>
            </Pressable>
          ))
        )}

        <View style={styles.actions}>
          <Button label="Añadir deuda" onPress={() => router.push('/debts/edit')} />
          {state.aliveCount > 0 ? (
            <Button
              label="Avalancha o bola de nieve"
              variant="secondary"
              onPress={() => router.push('/debts/strategy')}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(2),
  },
  spacer: { width: theme.minTouch },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(4),
    padding: theme.spacing(6),
  },
  content: { padding: theme.spacing(5), gap: theme.spacing(4) },
  hero: { alignItems: 'center', gap: theme.spacing(1), paddingVertical: theme.spacing(3) },
  card: { gap: theme.spacing(3) },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(3),
  },
  cardTitle: { flex: 1, gap: 2 },
  strong: { fontFamily: theme.fonts.semibold },
  empty: { textAlign: 'center', paddingVertical: theme.spacing(6) },
  actions: { gap: theme.spacing(2) },
});

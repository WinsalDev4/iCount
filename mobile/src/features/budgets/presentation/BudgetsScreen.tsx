import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { BudgetBar } from './BudgetBar';
import { useBudgetsViewModel } from './useBudgetsViewModel';

/** Presupuestos (screen 07-A "barras"): one bar per category, the most worrying on top. */
export function BudgetsScreen() {
  const vm = useBudgetsViewModel();
  const router = useRouter();
  const { state } = vm;

  const topBar = (
    <View style={styles.topBar}>
      <IconButton
        icon="back"
        accessibilityLabel="Volver"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/plan'))}
      />
      <AppText variant="displayM" accessibilityRole="header">
        Presupuestos
      </AppText>
      <View style={styles.topSpacer} />
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
          <Button label="Reintentar" variant="secondary" onPress={() => void vm.refresh()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {topBar}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthBar}>
          <IconButton icon="back" accessibilityLabel="Mes anterior" onPress={vm.previousMonth} />
          <AppText variant="displayM">{state.monthLabel}</AppText>
          <IconButton
            icon="forward"
            accessibilityLabel="Mes siguiente"
            onPress={vm.nextMonth}
            disabled={!state.canGoNext}
          />
        </View>

        {state.total ? (
          <GlassCard style={styles.card}>
            <AppText variant="label" tone="muted">
              TOTAL DEL MES
            </AppText>
            <BudgetBar
              title="Todos los presupuestos"
              amounts={`${state.total.spent} de ${state.total.limit}`}
              statusLabel={state.total.statusLabel}
              ratio={state.total.ratio}
              percent={state.total.percent}
              status={state.total.status}
            />
          </GlassCard>
        ) : null}

        {state.rows.length === 0 ? (
          <AppText tone="muted" style={styles.empty}>
            {state.isCurrentMonth
              ? 'Aún no tienes presupuestos este mes. Crea el primero para controlar un gasto.'
              : 'No había presupuestos este mes.'}
          </AppText>
        ) : (
          state.rows.map((row) => (
            <GlassCard key={row.id} style={styles.card}>
              <BudgetBar
                title={row.categoryName}
                amounts={`${row.spent} de ${row.limit}`}
                statusLabel={row.statusLabel}
                ratio={row.ratio}
                percent={row.percent}
                status={row.status}
              />
              {state.isCurrentMonth ? (
                <View style={styles.rowActions}>
                  <Button
                    label={`Editar ${row.categoryName}`}
                    variant="ghost"
                    onPress={() =>
                      router.push({ pathname: '/budgets/edit', params: { id: row.id } })
                    }
                  />
                  <Button
                    label={`Mover desde ${row.categoryName}`}
                    variant="ghost"
                    onPress={() =>
                      router.push({ pathname: '/budgets/move', params: { id: row.id } })
                    }
                  />
                </View>
              ) : null}
            </GlassCard>
          ))
        )}

        {state.isCurrentMonth ? (
          <Button label="Nuevo presupuesto" onPress={() => router.push('/budgets/edit')} />
        ) : null}
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
  topSpacer: { width: theme.minTouch },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(4),
    padding: theme.spacing(6),
  },
  content: { padding: theme.spacing(5), gap: theme.spacing(4) },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { gap: theme.spacing(3) },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  empty: { textAlign: 'center', paddingVertical: theme.spacing(6) },
});

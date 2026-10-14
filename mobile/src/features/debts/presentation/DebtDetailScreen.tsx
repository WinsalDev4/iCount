import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { ListItem } from '@/shared/ui/ListItem';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useDebtDetailViewModel } from './useDebtDetailViewModel';

/** Detalle de una deuda (screen 08-B): progress ring, instalment, end date and the extra-payment simulator. */
export function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useDebtDetailViewModel(id);
  const router = useRouter();
  const { state } = vm;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/debts'));
  const topBar = (
    <View style={styles.topBar}>
      <IconButton icon="back" accessibilityLabel="Volver" onPress={close} />
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

  if (state.status === 'not-found' || state.status === 'error') {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <AppText variant="displayM" style={styles.centerText}>
            {state.status === 'not-found' ? 'Esta deuda ya no existe' : 'No se pudo cargar'}
          </AppText>
          {state.status === 'error' ? (
            <AppText tone="muted" style={styles.centerText} accessibilityRole="alert">
              {state.message}
            </AppText>
          ) : null}
          <Button label="Volver" variant="secondary" onPress={close} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {topBar}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titles}>
          <AppText variant="displayL" accessibilityRole="header">
            {state.name}
          </AppText>
          <AppText tone="muted">
            {state.kindLabel} · {state.rate}
          </AppText>
        </View>

        <View style={styles.ringBox}>
          <ProgressRing
            value={state.paidRatio}
            size={168}
            strokeWidth={14}
            color={state.paidOff ? theme.colors.income : theme.colors.accent}
            accessibilityLabel={`Pagado: ${state.paidPercent} %`}
          >
            <AppText variant="displayL">{state.paidPercent} %</AppText>
            <AppText variant="small" tone="muted">
              pagado
            </AppText>
          </ProgressRing>
          <AppText variant="displayM">{state.outstanding}</AppText>
          <AppText variant="small" tone="muted">
            pendientes de {state.principal}
          </AppText>
        </View>

        <GlassCard>
          <ListItem title="Cuota mensual" trailing={state.monthlyPayment} />
          <ListItem title="Fin de la deuda" trailing={state.endDate} />
          {state.nextPayment ? (
            <ListItem title="Próxima cuota" trailing={state.nextPayment} />
          ) : null}
          <ListItem title="Te quedan" trailing={state.remaining} />
        </GlassCard>

        {!state.paidOff ? (
          <GlassCard style={styles.simulator}>
            <AppText variant="label" tone="muted">
              ¿Y SI PAGAS DE MÁS CADA MES?
            </AppText>
            <View style={styles.chips}>
              {state.extraChips.map((chip) => (
                <Chip
                  key={chip.minor}
                  label={chip.label}
                  selected={chip.selected}
                  onPress={() => vm.selectExtra(chip.minor)}
                />
              ))}
            </View>
            {state.simulation ? (
              <View accessibilityLiveRegion="polite" style={styles.result}>
                <AppText variant="displayM" tone="income">
                  {state.simulation.headline}
                </AppText>
                <AppText>Ahorras {state.simulation.interestSaved} en intereses</AppText>
                <AppText tone="muted">
                  Acabarías en {state.simulation.newEndDate} en vez de{' '}
                  {state.simulation.baselineEndDate}
                </AppText>
              </View>
            ) : state.simulationError ? (
              <AppText tone="expense" accessibilityRole="alert">
                {state.simulationError}
              </AppText>
            ) : (
              <AppText tone="muted">Elige un importe para ver cuánto te ahorras.</AppText>
            )}
          </GlassCard>
        ) : null}

        {state.error ? (
          <AppText tone="expense" accessibilityRole="alert">
            {state.error}
          </AppText>
        ) : null}

        {state.confirmingDelete ? (
          <GlassCard style={styles.confirm}>
            <AppText variant="displayM">¿Eliminar esta deuda?</AppText>
            <AppText tone="muted">Esta acción no se puede deshacer.</AppText>
            <Button
              label="Eliminar definitivamente"
              variant="danger"
              loading={state.busy}
              onPress={async () => {
                if (await vm.confirmDelete()) close();
              }}
            />
            <Button label="No, conservar" variant="ghost" onPress={vm.cancelDelete} />
          </GlassCard>
        ) : (
          <View style={styles.actions}>
            <Button
              label="Editar deuda"
              onPress={() => router.push({ pathname: '/debts/edit', params: { id } })}
            />
            <Button label="Eliminar deuda" variant="secondary" onPress={vm.requestDelete} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(2),
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(4),
    padding: theme.spacing(6),
  },
  centerText: { textAlign: 'center' },
  content: { padding: theme.spacing(5), gap: theme.spacing(5) },
  titles: { gap: 2 },
  ringBox: { alignItems: 'center', gap: theme.spacing(2) },
  simulator: { gap: theme.spacing(3) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  result: { gap: theme.spacing(1) },
  confirm: { gap: theme.spacing(3) },
  actions: { gap: theme.spacing(2) },
});

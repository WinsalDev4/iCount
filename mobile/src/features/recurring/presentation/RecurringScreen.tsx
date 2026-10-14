import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CalendarGrid } from '@/features/transactions/presentation/history/CalendarGrid';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { ListItem } from '@/shared/ui/ListItem';
import { Screen } from '@/shared/ui/Screen';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SwitchRow } from '@/shared/ui/SwitchRow';
import { theme } from '@/shared/ui/theme';

import { type DueRow, useRecurringViewModel } from './useRecurringViewModel';

/**
 * Pagos recurrentes (screen 08-D): what falls due soon, the month on a calendar, the payments
 * themselves and the switch for the reminder the day before.
 */
export function RecurringScreen() {
  const vm = useRecurringViewModel();
  const { state } = vm;
  const router = useRouter();

  const topBar = (
    <View style={styles.topBar}>
      <IconButton
        icon="back"
        accessibilityLabel="Volver"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/plan'))}
      />
      <AppText variant="displayM" accessibilityRole="header">
        Recurrentes
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
          <Button label="Reintentar" variant="secondary" onPress={() => void vm.refresh()} />
        </View>
      </Screen>
    );
  }

  const openPayment = (paymentId: string) =>
    router.push({ pathname: '/recurring/edit', params: { id: paymentId } });
  const dueItem = (row: DueRow) => (
    <ListItem
      key={row.key}
      title={row.name}
      subtitle={row.when}
      trailing={row.amount}
      trailingTone={row.tone}
      onPress={() => openPayment(row.paymentId)}
    />
  );

  return (
    <Screen>
      {topBar}
      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.reminders}>
          <SwitchRow
            label="Avisarme el día antes"
            description="Una notificación a las 9:00 por cada pago que vence."
            value={state.reminders.enabled}
            disabled={state.reminders.busy}
            onValueChange={(value) => void vm.setReminders(value)}
          />
          {state.reminders.notice ? (
            <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
              {state.reminders.notice}
            </AppText>
          ) : null}
        </GlassCard>

        <SegmentedControl
          accessibilityLabel="Vista"
          value={state.tab}
          onChange={vm.selectTab}
          options={[
            { value: 'list', label: 'Lista' },
            { value: 'calendar', label: 'Calendario' },
          ]}
        />

        {state.tab === 'list' ? (
          <>
            <View accessible style={styles.hero}>
              <AppText variant="label" tone="muted">
                PRÓXIMOS 30 DÍAS
              </AppText>
              <AppText variant="displayXl">{state.next30DaysExpenses ?? '0 €'}</AppText>
              <AppText tone="muted">
                {state.upcoming.length === 0
                  ? 'No vence ningún pago en las próximas semanas.'
                  : `${state.upcoming.length} ${state.upcoming.length === 1 ? 'vencimiento' : 'vencimientos'}`}
              </AppText>
            </View>
            {state.upcoming.map(dueItem)}

            <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.section}>
              TUS PAGOS RECURRENTES
            </AppText>
            {state.payments.length === 0 ? (
              <AppText tone="muted">
                Aún no tienes pagos recurrentes. Añade facturas, letras o suscripciones y te
                avisaremos antes de cada vencimiento.
              </AppText>
            ) : (
              state.payments.map((payment) => (
                <ListItem
                  key={payment.id}
                  title={payment.name}
                  subtitle={`${payment.kindLabel} · ${payment.rule} · ${payment.next}`}
                  trailing={payment.amount}
                  trailingTone={payment.tone}
                  onPress={() => openPayment(payment.id)}
                />
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.monthBar}>
              <IconButton
                icon="back"
                accessibilityLabel="Mes anterior"
                onPress={vm.previousMonth}
              />
              <AppText variant="displayM" accessibilityLiveRegion="polite">
                {state.monthLabel}
              </AppText>
              <IconButton
                icon="forward"
                accessibilityLabel="Mes siguiente"
                onPress={vm.nextMonth}
              />
            </View>
            <CalendarGrid weekdays={state.weekdays} weeks={state.weeks} onSelect={vm.selectDay} />
            <AppText tone="muted">{state.monthSummary}</AppText>

            <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.section}>
              {state.heading.toUpperCase()}
            </AppText>
            {state.dayRows.length === 0 ? (
              <AppText tone="muted">Ese día no vence ningún pago.</AppText>
            ) : (
              state.dayRows.map(dueItem)
            )}
          </>
        )}

        <Button label="Añadir pago recurrente" onPress={() => router.push('/recurring/edit')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  reminders: { gap: theme.spacing(2) },
  hero: { gap: theme.spacing(1) },
  section: { marginTop: theme.spacing(2) },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { AvatarStack } from '@/shared/ui/Avatar';
import { BarChart } from '@/shared/ui/BarChart';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { ListItem } from '@/shared/ui/ListItem';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useHomeViewModel } from './useHomeViewModel';

/** Inicio (screen 04-C "gasto diario"): the number that matters is what you can spend TODAY. */
export function HomeScreen() {
  const { state, refresh } = useHomeViewModel();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Cargando" />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <AppText tone="muted" style={styles.centerText} accessibilityRole="alert">
            {state.message}
          </AppText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refresh()} />
        </View>
      </Screen>
    );
  }

  const tone = state.allowanceStatus === 'on-track' ? 'text' : 'expense';

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTexts}>
            <AppText variant="label" tone="muted">
              TU HOGAR
            </AppText>
            <AppText variant="displayM" numberOfLines={1}>
              {state.householdName}
            </AppText>
          </View>
          {state.memberNames.length > 0 ? <AvatarStack names={state.memberNames} /> : null}
        </View>

        <View
          accessible
          accessibilityLabel={`Te quedan ${state.leftToday} para gastar hoy. ${state.caption}`}
          style={styles.hero}
        >
          <AppText variant="label" tone="muted">
            DISPONIBLE HOY
          </AppText>
          <AppText variant="displayXxl" tone={tone} adjustsFontSizeToFit numberOfLines={1}>
            {state.leftToday}
          </AppText>
          <AppText tone="muted" style={styles.centerText}>
            {state.caption}
          </AppText>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText variant="label" tone="muted">
              ESTA SEMANA
            </AppText>
            <AppText style={styles.strong}>{state.weekTotal}</AppText>
          </View>
          <BarChart bars={state.weekBars} />
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText variant="label" tone="muted">
              QUEDA EN EL MES
            </AppText>
            <AppText
              style={styles.strong}
              tone={state.allowanceStatus === 'month-in-deficit' ? 'expense' : 'income'}
            >
              {state.monthBalance}
            </AppText>
          </View>
        </GlassCard>

        {/* state.budgets: the budgets block appears here in phase 4 (B-4.1). */}

        <View style={styles.recent}>
          <AppText variant="label" tone="muted">
            ÚLTIMOS MOVIMIENTOS
          </AppText>
          {state.recent.length === 0 ? (
            <AppText tone="muted">Aún no hay movimientos. Pulsa + para añadir el primero.</AppText>
          ) : (
            state.recent.map((row) => (
              <ListItem
                key={row.id}
                title={row.title}
                subtitle={row.subtitle}
                trailing={row.amount}
                trailingTone={row.tone}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(6),
    gap: theme.spacing(4),
  },
  centerText: { textAlign: 'center' },
  content: { padding: theme.spacing(5), gap: theme.spacing(5) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTexts: { flex: 1, gap: 2 },
  hero: { alignItems: 'center', gap: theme.spacing(2), paddingVertical: theme.spacing(4) },
  card: { gap: theme.spacing(4) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strong: { fontFamily: theme.fonts.semibold },
  recent: { gap: theme.spacing(2) },
});

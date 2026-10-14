import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { ListItem } from '@/shared/ui/ListItem';
import { Screen } from '@/shared/ui/Screen';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { CalendarGrid } from './CalendarGrid';
import { useHistoryViewModel, type HistoryRow, type TypeFilter } from './useHistoryViewModel';

const typeOptions = [
  { value: 'all', label: 'Todo' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
] as const satisfies readonly { value: TypeFilter; label: string }[];

/** Historial (screen 06-B "calendario"): heat map on top, the day (or the search) below. */
export function HistoryScreen() {
  const vm = useHistoryViewModel();
  const router = useRouter();
  const { state } = vm;
  const [refreshing, setRefreshing] = useState(false);

  if (state.status === 'loading') {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Cargando" />
        </View>
      </Screen>
    );
  }

  const refresh = async () => {
    setRefreshing(true);
    try {
      await vm.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.monthBar}>
        <IconButton icon="back" accessibilityLabel="Mes anterior" onPress={vm.previousMonth} />
        <View style={styles.monthTitle} accessible accessibilityRole="header">
          <AppText variant="displayM">{state.monthLabel}</AppText>
        </View>
        <IconButton
          icon="forward"
          accessibilityLabel="Mes siguiente"
          onPress={vm.nextMonth}
          disabled={!state.canGoNext}
        />
      </View>

      <GlassCard style={styles.calendar}>
        <CalendarGrid weekdays={state.weekdays} weeks={state.weeks} onSelect={vm.selectDay} />
        <View style={styles.monthTotals}>
          <AppText variant="small" tone="income">
            Ingresos {state.monthIncome}
          </AppText>
          <AppText variant="small" tone="expense">
            Gastos {state.monthExpenses}
          </AppText>
        </View>
      </GlassCard>

      <TextField
        label="Buscar"
        value={state.searchText}
        onChangeText={vm.setSearchText}
        placeholder="Supermercado, nómina…"
        returnKeyType="search"
        autoCorrect={false}
      />
      <SegmentedControl
        accessibilityLabel="Tipo de movimiento"
        options={typeOptions}
        value={state.typeFilter}
        onChange={vm.setTypeFilter}
      />
      <View style={styles.chips}>
        <Chip
          label="Solo compartidos"
          selected={state.sharedOnly}
          onPress={() => vm.setSharedOnly(!state.sharedOnly)}
        />
        {state.filtering ? <Chip label="Quitar filtros" onPress={vm.clearFilters} /> : null}
      </View>

      <AppText variant="label" tone="muted" accessibilityRole="header">
        {state.heading.toUpperCase()}
      </AppText>
    </View>
  );

  const renderRow = ({ item }: { item: HistoryRow }) => (
    <View style={styles.rowPadding}>
      <ListItem
        title={item.title}
        subtitle={item.subtitle}
        trailing={item.amount}
        trailingTone={item.tone}
        onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
      />
    </View>
  );

  const empty =
    state.listStatus === 'loading' ? (
      <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Cargando movimientos" />
    ) : state.listStatus === 'error' ? (
      <View style={styles.emptyBox}>
        <AppText tone="muted" accessibilityRole="alert">
          No hemos podido cargar los movimientos.
        </AppText>
        <Button label="Reintentar" variant="secondary" onPress={() => void vm.refresh()} />
      </View>
    ) : (
      <AppText tone="muted" style={styles.emptyText}>
        {state.filtering
          ? 'Ningún movimiento coincide con tu búsqueda.'
          : 'Sin movimientos este día.'}
      </AppText>
    );

  return (
    <Screen edges={['top', 'left', 'right']}>
      <FlashList
        data={state.rows}
        renderItem={renderRow}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={styles.rowPadding}>{empty}</View>}
        ListFooterComponent={
          state.loadingMore ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <View style={styles.footer} />
          )
        }
        onEndReached={vm.loadMore}
        onEndReachedThreshold={0.4}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: theme.spacing(5), gap: theme.spacing(4) },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { flex: 1, alignItems: 'center' },
  calendar: { gap: theme.spacing(3) },
  monthTotals: { flexDirection: 'row', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(2) },
  rowPadding: { paddingHorizontal: theme.spacing(5) },
  emptyBox: { gap: theme.spacing(3), alignItems: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing(4) },
  footer: { height: theme.spacing(8) },
});

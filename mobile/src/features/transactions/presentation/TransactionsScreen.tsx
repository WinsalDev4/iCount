import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/shared/ui/theme';

import { useTransactionsViewModel } from './useTransactionsViewModel';

/** View: renders state and forwards events. No business logic here. */
export function TransactionsScreen() {
  const now = new Date();
  const { state } = useTransactionsViewModel('home', {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{state.message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Text style={styles.muted}>Balance del mes</Text>
      <Text
        style={[
          styles.balance,
          { color: state.isOverspent ? theme.colors.expense : theme.colors.income },
        ]}
      >
        {state.balance}
      </Text>
      <View style={styles.row}>
        <Text style={[styles.pill, { color: theme.colors.income }]}>↑ {state.income}</Text>
        <Text style={[styles.pill, { color: theme.colors.expense }]}>↓ {state.expenses}</Text>
      </View>
      <FlatList
        data={state.categories}
        keyExtractor={(item) => item.categoryId}
        renderItem={({ item }) => (
          <View style={styles.categoryRow}>
            <Text style={styles.text}>{item.categoryId}</Text>
            <Text style={styles.text}>{item.amount}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(6) },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  balance: { fontSize: 48, fontWeight: '800', marginVertical: theme.spacing(2) },
  row: { flexDirection: 'row', gap: theme.spacing(3), marginBottom: theme.spacing(6) },
  pill: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.surface,
  },
  text: { color: theme.colors.text, fontSize: 16 },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
});

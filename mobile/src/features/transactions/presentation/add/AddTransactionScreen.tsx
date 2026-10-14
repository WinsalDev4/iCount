import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { IconButton } from '@/shared/ui/IconButton';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { Screen } from '@/shared/ui/Screen';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SwitchRow } from '@/shared/ui/SwitchRow';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import type { TransactionType } from '../../domain/Transaction';
import { useAddTransactionViewModel } from './useAddTransactionViewModel';

const types = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
] as const satisfies readonly { value: TransactionType; label: string }[];

/** Screen 05-A "teclado propio": the amount is typed on our own keypad, in three taps and a save. */
export function AddTransactionScreen() {
  const vm = useAddTransactionViewModel();
  const router = useRouter();
  const { state } = vm;

  const save = async () => {
    if (await vm.submit()) router.back();
  };

  if (state.status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="back" accessibilityLabel="Cerrar" onPress={() => router.back()} />
        <View style={styles.segmented}>
          <SegmentedControl
            accessibilityLabel="Tipo de movimiento"
            options={types}
            value={state.type}
            onChange={vm.setType}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Importe ${state.amount} ${state.currencySymbol}`}
          style={styles.amountBox}
        >
          <AppText variant="displayXxl" tone={state.type === 'income' ? 'income' : 'expense'}>
            {state.amount}
          </AppText>
          <AppText variant="displayL" tone="muted">
            {state.currencySymbol}
          </AppText>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {state.categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={category.selected}
              onPress={() => vm.selectCategory(category.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.chips}>
          <Chip label="Hoy" selected={state.dayOffset === 0} onPress={() => vm.setDay(0)} />
          <Chip label="Ayer" selected={state.dayOffset === -1} onPress={() => vm.setDay(-1)} />
        </View>

        {state.canShare ? (
          <View style={styles.sharing}>
            <AppText variant="label" tone="muted">
              {state.type === 'income' ? 'LO COBRÓ' : 'LO PAGÓ'}
            </AppText>
            <View style={styles.chips}>
              {state.payers.map((payer) => (
                <Chip
                  key={payer.id}
                  label={payer.label}
                  selected={payer.selected}
                  onPress={() => vm.selectPayer(payer.id)}
                />
              ))}
            </View>
            <SwitchRow
              label="Compartido"
              description="Se reparte entre los miembros del hogar"
              value={state.shared}
              onValueChange={vm.setShared}
            />
          </View>
        ) : null}

        <TextField
          label="Nota (opcional)"
          value={state.description}
          onChangeText={vm.setDescription}
          placeholder="Supermercado, nómina…"
          returnKeyType="done"
        />

        {state.error ? (
          <AppText tone="expense" accessibilityRole="alert">
            {state.error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <NumericKeypad onKey={vm.pressKey} disabled={state.saving} />
        <Button
          label="Guardar"
          onPress={() => void save()}
          disabled={!state.canSave}
          loading={state.saving}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(2),
  },
  segmented: { flex: 1 },
  body: { padding: theme.spacing(5), gap: theme.spacing(4) },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(4),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(2) },
  sharing: { gap: theme.spacing(2) },
  footer: { padding: theme.spacing(4), gap: theme.spacing(3) },
});

import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { HouseholdId } from '@/core/domain/Ids';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { ListItem } from '@/shared/ui/ListItem';
import { OptionCard } from '@/shared/ui/OptionCard';
import { Screen } from '@/shared/ui/Screen';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { useSplitRuleViewModel } from './useSplitRuleViewModel';

/** Step 3 of a shared household: how are shared expenses divided? With a live preview. */
export function SplitRuleScreen() {
  const { householdId } = useLocalSearchParams<{ householdId?: string }>();
  const vm = useSplitRuleViewModel(householdId as HouseholdId | undefined);
  const { state } = vm;

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <AppText variant="displayXl">¿Cómo repartís los gastos?</AppText>
            <AppText tone="muted">Se aplica a lo que marquéis como compartido.</AppText>
          </View>

          <View accessibilityRole="radiogroup" style={styles.options}>
            <OptionCard
              title="A partes iguales"
              description="Cada persona paga lo mismo."
              selected={state.choice === 'equal'}
              onSelect={() => vm.choose('equal')}
            />
            <OptionCard
              title="Según ingresos"
              description="Quien gana más, aporta más."
              selected={state.choice === 'income-proportional'}
              onSelect={() => vm.choose('income-proportional')}
            />
            <OptionCard
              title="A medida"
              description="Tú decides el porcentaje de cada persona."
              disabledReason="Disponible cuando se una la otra persona."
              disabled={!state.customAvailable}
              selected={state.choice === 'custom'}
              onSelect={() => vm.choose('custom')}
            />
          </View>

          {state.choice === 'income-proportional' ? (
            <View style={styles.fields}>
              <TextField
                label="Tus ingresos al mes"
                value={state.myIncome}
                onChangeText={vm.setMyIncome}
                keyboardType="decimal-pad"
                placeholder="1.850,00"
              />
              <TextField
                label={`Ingresos de ${state.otherLabel} (solo para esta vista previa)`}
                value={state.otherIncome}
                onChangeText={vm.setOtherIncome}
                keyboardType="decimal-pad"
                placeholder="2.000,00"
              />
            </View>
          ) : null}

          {state.choice === 'custom' ? (
            <GlassCard style={styles.stepper}>
              <IconButton
                icon="back"
                accessibilityLabel="Bajar tu parte"
                onPress={() => vm.adjustMyShare(-1)}
              />
              <View
                style={styles.stepperValue}
                accessible
                accessibilityLabel={`Tu parte ${state.myPercent} por ciento`}
              >
                <AppText variant="displayL">{state.myPercent} %</AppText>
                <AppText variant="small" tone="muted">
                  tu parte
                </AppText>
              </View>
              <IconButton
                icon="plus"
                accessibilityLabel="Subir tu parte"
                onPress={() => vm.adjustMyShare(1)}
              />
            </GlassCard>
          ) : null}

          <GlassCard style={styles.preview}>
            <AppText variant="label" tone="muted">
              {`UN GASTO DE ${state.sampleExpense}`}
            </AppText>
            {state.preview.map((row) => (
              <ListItem
                key={row.label}
                title={row.label}
                subtitle={row.percent}
                trailing={row.amount}
              />
            ))}
            {state.previewNote ? (
              <AppText variant="small" tone="muted">
                {state.previewNote}
              </AppText>
            ) : null}
          </GlassCard>

          {state.error ? (
            <AppText tone="expense" accessibilityRole="alert">
              {state.error}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <Button
              label="Guardar y empezar"
              onPress={() => void vm.save()}
              loading={state.saving}
            />
            <Button label="Más tarde" variant="ghost" onPress={vm.skip} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: theme.spacing(6), gap: theme.spacing(5) },
  hero: { gap: theme.spacing(2) },
  options: { gap: theme.spacing(2) },
  fields: { gap: theme.spacing(4) },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperValue: { alignItems: 'center' },
  preview: { gap: theme.spacing(1) },
  actions: { gap: theme.spacing(2) },
});

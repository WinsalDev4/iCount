import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { Screen } from '@/shared/ui/Screen';
import { SwitchRow } from '@/shared/ui/SwitchRow';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { useRecurringFormViewModel } from './useRecurringFormViewModel';

/** Alta y edición de un pago recurrente. Editing keeps the first due date (history). */
export function RecurringFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useRecurringFormViewModel(id);
  const router = useRouter();
  const { state } = vm;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/recurring'));
  const topBar = (
    <View style={styles.topBar}>
      <IconButton icon="back" accessibilityLabel="Cerrar" onPress={close} />
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

  if (state.status === 'not-found') {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <AppText variant="displayM" style={styles.centerText}>
            Este pago ya no existe
          </AppText>
          <Button label="Volver" variant="secondary" onPress={close} />
        </View>
      </Screen>
    );
  }

  const editing = state.mode === 'edit';

  return (
    <Screen>
      {topBar}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="displayL" accessibilityRole="header">
            {editing ? 'Editar pago' : 'Nuevo pago recurrente'}
          </AppText>

          <TextField
            label="Nombre"
            value={state.name}
            onChangeText={vm.changeName}
            placeholder="Alquiler"
            maxLength={60}
          />

          <View style={styles.chips} accessibilityLabel="Tipo">
            {state.kinds.map((kind) => (
              <Chip
                key={kind.value}
                label={kind.label}
                selected={kind.selected}
                onPress={() => vm.selectKind(kind.value)}
              />
            ))}
          </View>

          <TextField
            label="Importe"
            value={state.amountText}
            onChangeText={vm.changeAmount}
            keyboardType="decimal-pad"
            placeholder="12,99"
            error={state.amountError}
          />

          <View style={styles.box}>
            <AppText variant="label" tone="muted">
              PERIODICIDAD
            </AppText>
            <View style={styles.chips}>
              {state.frequencies.map((frequency) => (
                <Chip
                  key={frequency.value}
                  label={frequency.label}
                  selected={frequency.selected}
                  onPress={() => vm.selectFrequency(frequency.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.box}>
            <AppText variant="label" tone="muted">
              {editing ? 'PRIMER VENCIMIENTO' : 'PRIMER VENCIMIENTO (FIJA EL DÍA)'}
            </AppText>
            <AppText accessibilityLiveRegion="polite">{state.firstDueLabel}</AppText>
            {editing ? null : (
              <View style={styles.chips}>
                <Chip label="−1 mes" onPress={() => vm.shiftFirstDue(-1)} />
                <Chip label="+1 mes" onPress={() => vm.shiftFirstDue(1)} />
                <Chip label="−1 día" onPress={() => vm.shiftFirstDueDays(-1)} />
                <Chip label="+1 día" onPress={() => vm.shiftFirstDueDays(1)} />
              </View>
            )}
          </View>

          <View style={styles.box}>
            <AppText variant="label" tone="muted">
              CATEGORÍA
            </AppText>
            <View style={styles.chips}>
              {state.categories.map((category) => (
                <Chip
                  key={category.value}
                  label={category.label}
                  selected={category.selected}
                  onPress={() => vm.selectCategory(category.value)}
                />
              ))}
            </View>
          </View>

          {state.canShare ? (
            <SwitchRow
              label="Compartido con el hogar"
              description="Aparecerá en el reparto de gastos."
              value={state.shared}
              onValueChange={vm.setShared}
            />
          ) : null}

          {state.error ? (
            <AppText tone="expense" accessibilityRole="alert">
              {state.error}
            </AppText>
          ) : null}

          <Button
            label={editing ? 'Guardar cambios' : 'Añadir pago'}
            onPress={async () => {
              if (await vm.save()) close();
            }}
            disabled={!state.canSave}
            loading={state.busy && !state.confirmingDelete}
          />

          {editing ? (
            state.confirmingDelete ? (
              <GlassCard style={styles.confirm}>
                <AppText variant="displayM">¿Eliminar este pago?</AppText>
                <AppText tone="muted">Dejará de avisarte. No se puede deshacer.</AppText>
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
              <Button label="Eliminar pago" variant="secondary" onPress={vm.requestDelete} />
            )
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  content: { padding: theme.spacing(5), gap: theme.spacing(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  box: { gap: theme.spacing(2) },
  confirm: { gap: theme.spacing(3) },
});

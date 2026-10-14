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
import { IconButton } from '@/shared/ui/IconButton';
import { Screen } from '@/shared/ui/Screen';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { useDebtFormViewModel } from './useDebtFormViewModel';

/** Alta y edición de deudas. Editing leaves the borrowed amount and the start date alone (history). */
export function DebtFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useDebtFormViewModel(id);
  const router = useRouter();
  const { state } = vm;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/debts'));
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
            Esta deuda ya no existe
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
            {editing ? 'Editar deuda' : 'Nueva deuda'}
          </AppText>

          <TextField
            label="Nombre"
            value={state.name}
            onChangeText={vm.changeName}
            placeholder="Préstamo del coche"
            maxLength={60}
          />

          <View style={styles.chips}>
            {state.kinds.map((kind) => (
              <Chip
                key={kind.value}
                label={kind.label}
                selected={kind.selected}
                onPress={() => vm.selectKind(kind.value)}
              />
            ))}
          </View>

          {editing ? (
            <AppText tone="muted">
              Importe prestado: {state.principalText} € · primera cuota: {state.startLabel}
            </AppText>
          ) : (
            <>
              <TextField
                label="Importe prestado"
                value={state.principalText}
                onChangeText={vm.changePrincipal}
                keyboardType="decimal-pad"
                placeholder="12000"
                error={state.principalError}
              />
              <View style={styles.dateBox}>
                <AppText variant="label" tone="muted">
                  PRIMERA CUOTA
                </AppText>
                <AppText accessibilityLiveRegion="polite">{state.startLabel}</AppText>
                <View style={styles.chips}>
                  <Chip label="−1 año" onPress={() => vm.shiftStart(-12)} />
                  <Chip label="−1 mes" onPress={() => vm.shiftStart(-1)} />
                  <Chip label="+1 mes" onPress={() => vm.shiftStart(1)} />
                  <Chip label="+1 año" onPress={() => vm.shiftStart(12)} />
                </View>
              </View>
            </>
          )}

          <TextField
            label="Interés anual (TIN, %)"
            value={state.rateText}
            onChangeText={vm.changeRate}
            keyboardType="decimal-pad"
            placeholder="6,9"
            error={state.rateError}
          />
          <TextField
            label="Plazo (meses)"
            value={state.termText}
            onChangeText={vm.changeTerm}
            keyboardType="number-pad"
            placeholder="60"
            error={state.termError}
          />
          <TextField
            label="Cuota mensual (opcional)"
            value={state.paymentText}
            onChangeText={vm.changePayment}
            keyboardType="decimal-pad"
            placeholder="Si la dejas vacía la calculamos"
            error={state.paymentError}
          />

          {state.error ? (
            <AppText tone="expense" accessibilityRole="alert">
              {state.error}
            </AppText>
          ) : null}

          <Button
            label={editing ? 'Guardar cambios' : 'Añadir deuda'}
            onPress={async () => {
              if (await vm.save()) close();
            }}
            disabled={!state.canSave}
            loading={state.busy}
          />
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
  dateBox: { gap: theme.spacing(2) },
});

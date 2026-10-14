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
import { ListItem } from '@/shared/ui/ListItem';
import { Screen } from '@/shared/ui/Screen';
import { SwitchRow } from '@/shared/ui/SwitchRow';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { useTransactionDetailViewModel } from './useTransactionDetailViewModel';

/** One movement: read it, edit it, or delete it behind an explicit confirmation. */
export function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useTransactionDetailViewModel(id);
  const router = useRouter();
  const { state } = vm;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/history'));

  const header = (
    <View style={styles.topBar}>
      <IconButton icon="back" accessibilityLabel="Volver" onPress={close} />
    </View>
  );

  if (state.status === 'loading') {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Cargando" />
        </View>
      </Screen>
    );
  }

  if (state.status === 'not-found' || state.status === 'error') {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <AppText variant="displayM" style={styles.centerText}>
            {state.status === 'not-found' ? 'Este movimiento ya no existe' : 'No se pudo cargar'}
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

  const editing = state.mode === 'edit' && state.edit !== null;

  return (
    <Screen>
      {header}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View
            style={styles.hero}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${state.typeLabel} de ${state.amount}`}
          >
            <AppText variant="label" tone="muted">
              {state.typeLabel.toUpperCase()}
            </AppText>
            <AppText variant="displayXl" tone={state.type === 'income' ? 'income' : 'expense'}>
              {state.amount}
            </AppText>
          </View>

          {editing && state.edit ? (
            <View style={styles.form}>
              <TextField
                label="Importe"
                value={state.edit.amountText}
                onChangeText={vm.changeAmount}
                keyboardType="decimal-pad"
                error={state.edit.amountError}
              />
              <View style={styles.chips}>
                {state.edit.categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={category.selected}
                    onPress={() => vm.selectCategory(category.id)}
                  />
                ))}
              </View>
              <TextField
                label="Nota"
                value={state.edit.description}
                onChangeText={vm.changeDescription}
              />
              <View style={styles.dayRow}>
                <IconButton
                  icon="back"
                  accessibilityLabel="Día anterior"
                  onPress={() => vm.shiftDay(-1)}
                />
                <AppText style={styles.dayLabel} accessibilityLiveRegion="polite">
                  {state.edit.dayLabel}
                </AppText>
                <IconButton
                  icon="forward"
                  accessibilityLabel="Día siguiente"
                  onPress={() => vm.shiftDay(1)}
                  disabled={!state.edit.canGoNextDay}
                />
              </View>
              {state.edit.canShare ? (
                <SwitchRow
                  label="Compartido"
                  description="Se reparte entre los miembros del hogar"
                  value={state.edit.shared}
                  onValueChange={vm.setShared}
                />
              ) : null}
              <View style={styles.actions}>
                <Button
                  label="Guardar cambios"
                  onPress={() => void vm.saveEdit()}
                  disabled={!state.edit.canSave}
                  loading={state.busy}
                />
                <Button label="Cancelar" variant="ghost" onPress={vm.cancel} />
              </View>
            </View>
          ) : (
            <>
              <GlassCard style={styles.details}>
                <ListItem title="Categoría" trailing={state.categoryName} />
                <ListItem title="Fecha" trailing={state.dateLabel} />
                {state.payerLabel ? <ListItem title="Pagó" trailing={state.payerLabel} /> : null}
                <ListItem title="Compartido" trailing={state.shared ? 'Sí' : 'No'} />
                {state.description ? <ListItem title="Nota" trailing={state.description} /> : null}
              </GlassCard>

              {state.mode === 'confirm-delete' ? (
                <GlassCard style={styles.confirm}>
                  <AppText variant="displayM">¿Eliminar este movimiento?</AppText>
                  <AppText tone="muted">Esta acción no se puede deshacer.</AppText>
                  <Button
                    label="Eliminar definitivamente"
                    variant="danger"
                    loading={state.busy}
                    onPress={async () => {
                      if (await vm.confirmDelete()) close();
                    }}
                  />
                  <Button label="No, conservar" variant="ghost" onPress={vm.cancel} />
                </GlassCard>
              ) : (
                <View style={styles.actions}>
                  <Button label="Editar" onPress={vm.startEdit} />
                  <Button label="Eliminar" variant="secondary" onPress={vm.requestDelete} />
                </View>
              )}
            </>
          )}

          {state.error ? (
            <AppText tone="expense" accessibilityRole="alert">
              {state.error}
            </AppText>
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
    padding: theme.spacing(6),
    gap: theme.spacing(4),
  },
  centerText: { textAlign: 'center' },
  content: { padding: theme.spacing(5), gap: theme.spacing(5) },
  hero: { alignItems: 'center', gap: theme.spacing(1), paddingVertical: theme.spacing(3) },
  details: { gap: theme.spacing(0) },
  confirm: { gap: theme.spacing(3) },
  form: { gap: theme.spacing(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { flex: 1, textAlign: 'center' },
  actions: { gap: theme.spacing(2) },
});

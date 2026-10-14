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
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { useBudgetFormViewModel } from './useBudgetFormViewModel';

/** Create a budget (pick a free category + limit) or edit/delete an existing one. */
export function BudgetFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useBudgetFormViewModel(id);
  const router = useRouter();
  const { state } = vm;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/budgets'));
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
            Este presupuesto ya no existe
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
            {editing ? `Presupuesto de ${state.categoryName}` : 'Nuevo presupuesto'}
          </AppText>

          {!editing ? (
            state.categories.length === 0 ? (
              <AppText tone="muted">
                Ya tienes un presupuesto para cada categoría de gasto este mes.
              </AppText>
            ) : (
              <View style={styles.chips}>
                {state.categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={category.selected}
                    onPress={() => vm.selectCategory(category.id)}
                  />
                ))}
              </View>
            )
          ) : null}

          <TextField
            label="Límite del mes"
            value={state.limitText}
            onChangeText={vm.changeLimit}
            keyboardType="decimal-pad"
            placeholder="250"
            error={state.limitError}
          />

          {state.error ? (
            <AppText tone="expense" accessibilityRole="alert">
              {state.error}
            </AppText>
          ) : null}

          <Button
            label={editing ? 'Guardar cambios' : 'Crear presupuesto'}
            onPress={async () => {
              if (await vm.save()) close();
            }}
            disabled={!state.canSave}
            loading={state.busy && !state.confirmingDelete}
          />

          {editing ? (
            state.confirmingDelete ? (
              <GlassCard style={styles.confirm}>
                <AppText variant="displayM">¿Eliminar este presupuesto?</AppText>
                <AppText tone="muted">Tus movimientos no se borran, solo el límite.</AppText>
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
              <Button label="Eliminar presupuesto" variant="secondary" onPress={vm.requestDelete} />
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
  content: { padding: theme.spacing(5), gap: theme.spacing(5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  confirm: { gap: theme.spacing(3) },
});

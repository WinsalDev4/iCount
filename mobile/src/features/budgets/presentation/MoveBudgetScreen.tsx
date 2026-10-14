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

import { useMoveBudgetViewModel } from './useMoveBudgetViewModel';

/** Move part of one budget's limit to another: "I overspent on food, take it from leisure". */
export function MoveBudgetScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useMoveBudgetViewModel(id);
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

  if (state.status === 'not-found' || state.status === 'nothing-to-move') {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <AppText variant="displayM" style={styles.centerText}>
            {state.status === 'not-found'
              ? 'Este presupuesto ya no existe'
              : 'No hay nada que mover'}
          </AppText>
          {state.status === 'nothing-to-move' ? (
            <AppText tone="muted" style={styles.centerText}>
              Necesitas otro presupuesto este mes y que este tenga límite sin gastar.
            </AppText>
          ) : null}
          <Button label="Volver" variant="secondary" onPress={close} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {topBar}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="displayL" accessibilityRole="header">
            Mover desde {state.fromName}
          </AppText>
          <AppText tone="muted">
            Puedes mover hasta {state.movable} sin pasarte de lo ya gastado.
          </AppText>

          <AppText variant="label" tone="muted">
            HACIA
          </AppText>
          <View style={styles.chips}>
            {state.targets.map((target) => (
              <Chip
                key={target.id}
                label={target.name}
                selected={target.selected}
                onPress={() => vm.selectTarget(target.id)}
              />
            ))}
          </View>

          <TextField
            label="Importe a mover"
            value={state.amountText}
            onChangeText={vm.changeAmount}
            keyboardType="decimal-pad"
            placeholder="25"
            error={state.amountError}
          />

          {state.preview.length > 0 ? (
            <GlassCard style={styles.preview}>
              <AppText variant="label" tone="muted">
                QUEDARÍA ASÍ
              </AppText>
              {state.preview.map((line) => (
                <AppText key={line}>{line}</AppText>
              ))}
            </GlassCard>
          ) : null}

          {state.error ? (
            <AppText tone="expense" accessibilityRole="alert">
              {state.error}
            </AppText>
          ) : null}

          <Button
            label="Mover importe"
            onPress={async () => {
              if (await vm.submit()) close();
            }}
            disabled={!state.canMove}
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
  preview: { gap: theme.spacing(2) },
});

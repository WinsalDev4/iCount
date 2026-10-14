import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { GlassCard } from '@/shared/ui/GlassCard';
import { IconButton } from '@/shared/ui/IconButton';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useStrategyViewModel } from './useStrategyViewModel';

/** Avalancha vs bola de nieve (screen 08-C): two plans, same money, different order. */
export function StrategyScreen() {
  const { state, selectExtra } = useStrategyViewModel();
  const router = useRouter();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/debts'));
  const topBar = (
    <View style={styles.topBar}>
      <IconButton icon="back" accessibilityLabel="Volver" onPress={close} />
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

  if (state.status === 'error' || state.status === 'nothing-owed') {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <AppText variant="displayM" style={styles.centerText}>
            {state.status === 'nothing-owed' ? 'No hay deudas que comparar' : 'No se pudo calcular'}
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

  return (
    <Screen>
      {topBar}
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="displayL" accessibilityRole="header">
          ¿Por cuál empiezo?
        </AppText>
        <AppText tone="muted">
          Mismo dinero cada mes, distinto orden. Elige cuánto extra puedes poner.
        </AppText>

        <View style={styles.chips}>
          {state.extraChips.map((chip) => (
            <Chip
              key={chip.minor}
              label={chip.label}
              selected={chip.selected}
              onPress={() => selectExtra(chip.minor)}
            />
          ))}
        </View>

        <GlassCard style={styles.recommendation}>
          <AppText accessibilityLiveRegion="polite" style={styles.strong}>
            {state.recommendation}
          </AppText>
          {state.firstWin ? (
            <AppText variant="small" tone="muted">
              Con la bola de nieve, tu primera deuda saldada sería «{state.firstWin}».
            </AppText>
          ) : null}
        </GlassCard>

        {state.cards.map((card) => (
          <GlassCard key={card.key} style={styles.card}>
            <AppText variant="displayM">{card.title}</AppText>
            <AppText variant="small" tone="muted">
              {card.description}
            </AppText>
            <View style={styles.numbers}>
              <View>
                <AppText variant="label" tone="muted">
                  LIBRE DE DEUDAS
                </AppText>
                <AppText style={styles.strong}>{card.debtFreeDate}</AppText>
              </View>
              <View>
                <AppText variant="label" tone="muted">
                  INTERESES
                </AppText>
                <AppText style={styles.strong}>{card.totalInterest}</AppText>
              </View>
            </View>
            <View accessibilityLabel={`Orden: ${card.order.join(', ')}`}>
              {card.order.map((line) => (
                <AppText key={line} variant="small">
                  {line}
                </AppText>
              ))}
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  recommendation: { gap: theme.spacing(1) },
  card: { gap: theme.spacing(3) },
  numbers: { flexDirection: 'row', justifyContent: 'space-between' },
  strong: { fontFamily: theme.fonts.semibold },
});

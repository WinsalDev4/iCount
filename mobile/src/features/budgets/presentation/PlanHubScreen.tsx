import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { GlassCard } from '@/shared/ui/GlassCard';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

interface PlanEntry {
  readonly title: string;
  readonly description: string;
  readonly icon: IconName;
  readonly href: Href | null;
}

/** Where each planning tool lives. `href: null` means "arriving soon": shown, but not pressable. */
const entries: readonly PlanEntry[] = [
  {
    title: 'Presupuestos',
    description: 'Un límite por categoría y mes, con su progreso.',
    icon: 'target',
    href: '/budgets',
  },
  {
    title: 'Deudas',
    description: 'Cuánto debes, cuándo acabas y cuánto ahorras pagando extra.',
    icon: 'list',
    href: null,
  },
  {
    title: 'Recurrentes',
    description: 'Facturas, letras y suscripciones con su recordatorio.',
    icon: 'home',
    href: null,
  },
];

/** Tab "Planificar": the hub to budgets, debts and recurring payments. */
export function PlanHubScreen() {
  const router = useRouter();

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="displayL" accessibilityRole="header">
          Planificar
        </AppText>
        <AppText tone="muted">Ponte metas y que nada te pille por sorpresa.</AppText>

        <View style={styles.list}>
          {entries.map((entry) => {
            const available = entry.href !== null;
            return (
              <Pressable
                key={entry.title}
                accessibilityRole="button"
                accessibilityLabel={entry.title}
                accessibilityHint={available ? entry.description : 'Disponible próximamente'}
                accessibilityState={{ disabled: !available }}
                disabled={!available}
                onPress={() => entry.href && router.push(entry.href)}
              >
                <GlassCard style={[styles.card, !available && styles.soon]}>
                  <View style={styles.iconBox}>
                    <Icon name={entry.icon} size={24} color={theme.colors.accent} />
                  </View>
                  <View style={styles.texts}>
                    <AppText style={styles.title}>{entry.title}</AppText>
                    <AppText variant="small" tone="muted">
                      {available ? entry.description : 'Próximamente'}
                    </AppText>
                  </View>
                  {available ? (
                    <Icon name="forward" size={20} color={theme.colors.textMuted} />
                  ) : null}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing(5), gap: theme.spacing(4) },
  list: { gap: theme.spacing(3), marginTop: theme.spacing(2) },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  soon: { opacity: 0.55 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: theme.fonts.semibold },
});

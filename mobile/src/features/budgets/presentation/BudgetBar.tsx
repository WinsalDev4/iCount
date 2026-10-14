import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { theme } from '@/shared/ui/theme';

import type { BudgetStatus } from '../domain/budgetProgress';

const STATUS_COLOR: Record<BudgetStatus, string> = {
  ok: theme.colors.accent,
  warning: theme.colors.categories[3],
  exceeded: theme.colors.expense,
};

export type BudgetBarProps = {
  title: string;
  /** "42,00 € de 300,00 €" */
  amounts: string;
  /** "Quedan 258,00 €" / "Te has pasado 5,00 €" */
  statusLabel: string;
  ratio: number;
  percent: number;
  status: BudgetStatus;
};

/** One budget: name, amounts, a bar that turns amber at 80 % and red when exceeded, and the remainder. */
export function BudgetBar({ title, amounts, statusLabel, ratio, percent, status }: BudgetBarProps) {
  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <AppText style={styles.title}>{title}</AppText>
        <AppText variant="small" tone="muted">
          {amounts}
        </AppText>
      </View>
      <ProgressBar
        value={ratio}
        color={STATUS_COLOR[status]}
        accessibilityLabel={`${title}: ${percent} % del presupuesto`}
      />
      <AppText variant="small" tone={status === 'exceeded' ? 'expense' : 'muted'}>
        {statusLabel}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: theme.spacing(2) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: theme.fonts.semibold },
});

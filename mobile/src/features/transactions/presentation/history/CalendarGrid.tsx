import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { theme } from '@/shared/ui/theme';

import type { Intensity } from '../../domain/heatmap';
import type { DayCell } from './useHistoryViewModel';

/** How strong the accent shows for each spending level (0 = none … 4 = the heaviest days). */
const LEVEL_OPACITY: Record<Intensity, number> = { 0: 0, 1: 0.2, 2: 0.4, 3: 0.65, 4: 0.95 };

export type CalendarGridProps = {
  weekdays: readonly string[];
  weeks: readonly (readonly (DayCell | null)[])[];
  onSelect: (date: Date) => void;
};

/** Month heat map: each day is tinted by how much was spent (screen 06-B). */
export function CalendarGrid({ weekdays, weeks, onSelect }: CalendarGridProps) {
  return (
    <View accessibilityLabel="Calendario del mes" style={styles.grid}>
      <View style={styles.row}>
        {weekdays.map((letter, index) => (
          <View key={`${letter}-${index}`} style={styles.cellBox} importantForAccessibility="no">
            <AppText variant="label" tone="muted">
              {letter}
            </AppText>
          </View>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.row}>
          {week.map((cell, index) =>
            cell === null ? (
              <View key={`pad-${weekIndex}-${index}`} style={styles.cellBox} />
            ) : (
              <View key={cell.key} style={styles.cellBox}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cell.accessibilityLabel}
                  accessibilityState={{ selected: cell.selected }}
                  onPress={() => onSelect(cell.date)}
                  style={[
                    styles.cell,
                    cell.isToday && styles.today,
                    cell.selected && styles.selected,
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={[styles.heat, { opacity: LEVEL_OPACITY[cell.intensity] }]}
                  />
                  <AppText
                    variant="small"
                    tone={cell.intensity >= 3 ? 'onAccent' : 'text'}
                    style={cell.selected ? styles.bold : undefined}
                  >
                    {cell.day}
                  </AppText>
                </Pressable>
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const CELL = 44;

const styles = StyleSheet.create({
  grid: { gap: theme.spacing(1) },
  row: { flexDirection: 'row' },
  cellBox: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: CELL },
  cell: {
    width: CELL - 4,
    height: CELL - 4,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  heat: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.accent },
  today: { borderColor: theme.colors.accentSecondary },
  selected: { borderColor: theme.colors.text, borderWidth: 2 },
  bold: { fontFamily: theme.fonts.bold },
});

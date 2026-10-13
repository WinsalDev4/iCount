import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, type TextVariant } from './AppText';
import { Avatar, AvatarStack } from './Avatar';
import { Button } from './Button';
import { Chip } from './Chip';
import { Donut } from './Donut';
import { GlassCard } from './GlassCard';
import { Icon, iconNames } from './Icon';
import { IconButton } from './IconButton';
import { ListItem } from './ListItem';
import { ProgressBar } from './ProgressBar';
import { ProgressRing } from './ProgressRing';
import { Screen } from './Screen';
import { SegmentedControl } from './SegmentedControl';
import { theme } from './theme';

const variants = Object.keys(theme.typography) as TextVariant[];
const people = ['Ana Ruiz', 'Leo Marín', 'Carla Soto', 'Dani Vega', 'Eva Gil', 'Raúl Pons'];
const periods = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
] as const;
const noop = () => {};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="muted">
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

/** Visual catalog of the design system. Mounted at /dev/catalog (only in __DEV__). */
export function DesignCatalog() {
  const [period, setPeriod] = useState<(typeof periods)[number]['value']>('month');
  const [chip, setChip] = useState(true);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="displayL">Midnight Glass</AppText>

        <Section title="Tipografía">
          {variants.map((variant) => (
            <AppText key={variant} variant={variant}>
              {variant} · 1.534,75 €
            </AppText>
          ))}
        </Section>

        <Section title="Botones">
          <Button label="Guardar movimiento" onPress={noop} />
          <Button label="Cancelar" variant="secondary" onPress={noop} />
          <Button label="Saltar" variant="ghost" onPress={noop} />
          <Button label="Guardando" loading onPress={noop} />
          <View style={styles.row}>
            <IconButton icon="back" accessibilityLabel="Atrás" onPress={noop} />
            <IconButton icon="send" accessibilityLabel="Enviar" variant="filled" onPress={noop} />
          </View>
        </Section>

        <Section title="Selección">
          <View style={styles.row}>
            <Chip label="Comida" selected={chip} onPress={() => setChip((c) => !c)} />
            <Chip label="Transporte" onPress={noop} />
            <Chip label="Etiqueta fija" />
          </View>
          <SegmentedControl
            accessibilityLabel="Periodo"
            options={periods}
            value={period}
            onChange={setPeriod}
          />
        </Section>

        <Section title="Progreso y gráficos">
          <ProgressBar value={0.62} accessibilityLabel="Presupuesto de ocio" />
          <ProgressBar value={1.2} color={theme.colors.expense} accessibilityLabel="Excedido" />
          <View style={styles.row}>
            <ProgressRing value={0.72} accessibilityLabel="Meta de ahorro">
              <AppText variant="displayM">72%</AppText>
            </ProgressRing>
            <Donut
              accessibilityLabel="Gasto por categoría"
              slices={theme.colors.categories.map((color, i) => ({ color, value: 5 - i }))}
            >
              <AppText variant="label" tone="muted">
                Gastos
              </AppText>
            </Donut>
          </View>
        </Section>

        <Section title="Personas">
          <View style={styles.row}>
            <Avatar name="Ana Ruiz" />
            <Avatar name="Leo" />
            <AvatarStack names={people} />
          </View>
        </Section>

        <Section title="Cristal y listas">
          <GlassCard>
            <ListItem
              title="Supermercado"
              subtitle="Comida · hoy"
              leading={<Avatar name="Ana Ruiz" size={36} />}
              trailing="-54,20 €"
              trailingTone="expense"
              onPress={noop}
            />
            <ListItem
              title="Nómina"
              subtitle="Ingreso · 1 oct"
              leading={<Icon name="plus" color={theme.colors.income} />}
              trailing="+1.925,00 €"
              trailingTone="income"
            />
          </GlassCard>
        </Section>

        <Section title="Iconos">
          <View style={styles.row}>
            {iconNames.map((name) => (
              <Icon key={name} name={name} size={28} />
            ))}
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing(5), gap: theme.spacing(6) },
  section: { gap: theme.spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(3) },
});

import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useBiometricsViewModel } from './useBiometricsViewModel';

/**
 * One-time offer after the first sign-in: unlock with fingerprint / face instead of a new link.
 * Either answer changes the access phase and the router moves on; it is never shown again
 * (the switch lives in the account card).
 */
export function EnableBiometricsScreen() {
  const { state, setEnabled, markPrompted } = useBiometricsViewModel();

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Icon name="users" size={40} color={theme.colors.accent} />
          <AppText variant="displayXl">Abre iCount con tu cara o huella</AppText>
          <AppText tone="muted">
            Se queda en este dispositivo: protege tus datos si alguien coge el móvil desbloqueado.
          </AppText>
        </View>

        {state.error ? (
          <AppText tone="expense" accessibilityRole="alert">
            {state.error}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Activar desbloqueo"
            onPress={() => void setEnabled(true)}
            loading={state.busy}
          />
          <Button label="Ahora no" variant="ghost" onPress={markPrompted} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing(6),
    gap: theme.spacing(6),
  },
  hero: { gap: theme.spacing(3) },
  actions: { gap: theme.spacing(2) },
});

import { StyleSheet } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { SwitchRow } from '@/shared/ui/SwitchRow';
import { theme } from '@/shared/ui/theme';

import { useAccountViewModel } from './useAccountViewModel';
import { useBiometricsViewModel } from './useBiometricsViewModel';

/** Account section: who is signed in, the biometric switch and sign-out. */
export function AccountCard() {
  const account = useAccountViewModel();
  const biometrics = useBiometricsViewModel();

  return (
    <GlassCard style={styles.card}>
      <AppText variant="label" tone="muted">
        CUENTA
      </AppText>
      <AppText>{account.state.email}</AppText>
      {biometrics.state.available ? (
        <SwitchRow
          label="Desbloqueo biométrico"
          description="Huella o cara al abrir la app"
          value={biometrics.state.enabled}
          onValueChange={(value) => void biometrics.setEnabled(value)}
          disabled={biometrics.state.busy}
        />
      ) : null}
      {biometrics.state.error ? (
        <AppText tone="expense" accessibilityRole="alert">
          {biometrics.state.error}
        </AppText>
      ) : null}
      <Button
        label="Cerrar sesión"
        variant="secondary"
        onPress={() => void account.signOut()}
        loading={account.state.signingOut}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({ card: { gap: theme.spacing(3) } });

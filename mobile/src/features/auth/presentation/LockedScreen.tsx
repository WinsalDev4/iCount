import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useLockViewModel } from './useLockViewModel';

/** Shown on a cold start when the biometric unlock is on: prompts once, then offers a retry. */
export function LockedScreen() {
  const { state, unlock, signOut } = useLockViewModel();
  const prompted = useRef(false);

  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void unlock();
  }, [unlock]);

  return (
    <Screen>
      <View style={styles.content}>
        <Icon name="home" size={40} color={theme.colors.accent} />
        <AppText variant="displayL" style={styles.center}>
          iCount está bloqueado
        </AppText>
        <AppText tone="muted" style={styles.center}>
          {state.status === 'failed'
            ? 'No se pudo confirmar tu identidad.'
            : 'Confirma que eres tú para continuar.'}
        </AppText>
        <Button
          label="Desbloquear"
          onPress={() => void unlock()}
          loading={state.status === 'checking'}
        />
        <Button label="Cerrar sesión" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing(6),
    gap: theme.spacing(5),
  },
  center: { textAlign: 'center' },
});

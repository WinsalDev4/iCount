import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { useVerifyViewModel } from './useVerifyViewModel';

/**
 * Landing of the magic link (`icount://auth/verify?token=…`). On success it does not navigate:
 * the session it stores flips the access phase and the router leaves this route.
 */
export function VerifyScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { state } = useVerifyViewModel(params.token);

  return (
    <Screen>
      <View style={styles.content}>
        {state.status === 'verifying' ? (
          <>
            <ActivityIndicator color={theme.colors.accent} size="large" />
            <AppText variant="displayM">Comprobando tu enlace…</AppText>
          </>
        ) : (
          <>
            <Icon name="back" size={40} color={theme.colors.expense} />
            <AppText variant="displayL" style={styles.center}>
              No hemos podido entrar
            </AppText>
            <AppText tone="muted" style={styles.center} accessibilityRole="alert">
              {state.message}
            </AppText>
            <Button label="Pedir un enlace nuevo" onPress={() => router.replace('/sign-in')} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: theme.spacing(6),
    gap: theme.spacing(5),
  },
  center: { textAlign: 'center' },
});

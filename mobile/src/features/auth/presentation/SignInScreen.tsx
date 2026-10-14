import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Screen } from '@/shared/ui/Screen';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { useSignInViewModel } from './useSignInViewModel';

/** Screen 02-C "sin contraseña": only an email, a link and (later) a fingerprint. */
export function SignInScreen() {
  const { state, setEmail, submit } = useSignInViewModel();
  const router = useRouter();

  const send = async () => {
    const sentTo = await submit();
    if (sentTo) router.push({ pathname: '/check-email', params: { email: sentTo } });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Icon name="send" size={40} color={theme.colors.accent} />
            <AppText variant="displayXl">Entra sin contraseña</AppText>
            <AppText tone="muted">
              Escribe tu correo y te enviamos un enlace de un solo uso. Sin claves que recordar.
            </AppText>
          </View>

          <TextField
            label="Correo electrónico"
            value={state.email}
            onChangeText={setEmail}
            placeholder="ana@casa.app"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => state.canSubmit && void send()}
            error={state.status === 'error' ? state.message : null}
          />

          <Button
            label="Enviarme el enlace"
            onPress={() => void send()}
            loading={state.status === 'sending'}
            disabled={!state.canSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing(6),
    gap: theme.spacing(6),
  },
  hero: { gap: theme.spacing(3) },
});

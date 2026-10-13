import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

/** Provisional modal: B-3.1 replaces this with the "Añadir movimiento" keypad screen. */
export default function AddRoute() {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ flex: 1, padding: theme.spacing(5), gap: theme.spacing(5) }}>
        <AppText variant="displayL">Añadir movimiento</AppText>
        <AppText tone="muted">El teclado numérico llegará en la fase 3.</AppText>
        <Button label="Cerrar" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

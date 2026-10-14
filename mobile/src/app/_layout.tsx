import { Sora_400Regular, Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { DependenciesProvider } from '@/core/di/DependenciesProvider';
import { createQueryClient } from '@/core/query/queryClient';
import { useAccess } from '@/features/auth/presentation/useAccess';
import { theme } from '@/shared/ui/theme';

// Module scope on purpose: it must run before the first render or the splash may already be gone.
void SplashScreen.preventAutoHideAsync();

// Keys must match `theme.fonts`.
const fontMap = {
  [theme.fonts.regular]: Sora_400Regular,
  [theme.fonts.semibold]: Sora_600SemiBold,
  [theme.fonts.bold]: Sora_700Bold,
};

export default function RootLayout() {
  // Retry policy and cache defaults: docs/architecture/red.md
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const fontsReady = fontsLoaded || fontError !== null;

  if (!fontsReady) return null;

  return (
    <DependenciesProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AccessStack />
      </QueryClientProvider>
    </DependenciesProvider>
  );
}

/**
 * The route tree, gated by the access phase (onboarding → sign-in → biometric lock → app) with
 * Expo Router's protected routes: when a guard turns false the router moves the user out of
 * that group by itself, so no screen has to redirect "just in case".
 * The splash stays up until the stored flags and session have been read, so nobody sees a
 * flash of the wrong screen.
 */
function AccessStack() {
  const { phase } = useAccess();

  useEffect(() => {
    // On a font error we still open the app (system font) instead of trapping the user on the splash.
    if (phase !== 'loading') void SplashScreen.hideAsync();
  }, [phase]);

  if (phase === 'loading') return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Protected guard={phase === 'onboarding'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'signed-out'}>
        <Stack.Screen name="(auth)" />
        {/* The magic link lives here: storing the session flips the phase, and the router
            then leaves this route by itself. Opened while signed in, the link is just ignored. */}
        <Stack.Screen name="auth/verify" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'locked'}>
        <Stack.Screen name="(locked)" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'offer-biometrics'}>
        <Stack.Screen name="enable-biometrics" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'setup'}>
        <Stack.Screen name="(setup)" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="dev/catalog" />
      </Stack.Protected>
    </Stack>
  );
}

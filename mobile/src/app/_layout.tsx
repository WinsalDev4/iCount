import { Sora_400Regular, Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { DependenciesProvider } from '@/core/di/DependenciesProvider';
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
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    // On a font error we still open the app (system font) instead of trapping the user on the splash.
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <DependenciesProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
      </QueryClientProvider>
    </DependenciesProvider>
  );
}

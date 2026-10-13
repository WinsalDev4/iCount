import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { DependenciesProvider } from '@/core/di/DependenciesProvider';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <DependenciesProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </DependenciesProvider>
  );
}

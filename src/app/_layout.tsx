import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { getDatabase } from '@/db/client';
// Importing the task module registers the background location task at startup.
import '@/tracking/locationTask';
import { restoreRecording } from '@/tracking/recorder';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        await restoreRecording();
      } catch (err) {
        console.warn('[startup] initialization failed', err);
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="route/[id]" options={{ headerShown: true, title: 'Route' }} />
          <Stack.Screen name="hike/[id]" options={{ headerShown: true, title: 'Hike' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

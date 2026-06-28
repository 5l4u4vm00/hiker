import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { getDatabase } from '@/db/client';
import { useColorScheme } from '@/hooks/use-color-scheme';
// Importing the i18n module initializes i18next before the first render.
import '@/i18n';
import { useLanguageStore } from '@/state/languageStore';
import { useThemeStore } from '@/state/themeStore';
// Importing the task module registers the background location task at startup.
import '@/tracking/locationTask';
import { restoreRecording } from '@/tracking/recorder';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        await useThemeStore.getState().hydrate();
        await useLanguageStore.getState().hydrate();
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
          <Stack.Screen
            name="route/[id]"
            options={{ headerShown: true, title: t('nav.route'), headerBackTitle: t('common.back') }}
          />
          <Stack.Screen
            name="hike/[id]"
            options={{ headerShown: true, title: t('nav.hike'), headerBackTitle: t('common.back') }}
          />
          <Stack.Screen
            name="plan"
            options={{ headerShown: true, title: t('plan.title'), headerBackTitle: t('common.back') }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

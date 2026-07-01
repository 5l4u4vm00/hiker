import { OfflineManager } from '@maplibre/maplibre-react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initAds } from '@/ads/admob';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { getDatabase } from '@/db/client';
import { seedPoisIfEmpty } from '@/db/pois';
import { useColorScheme } from '@/hooks/use-color-scheme';
// Importing the i18n module initializes i18next before the first render.
import '@/i18n';
import { useLanguageStore } from '@/state/languageStore';
import { useMapLayerStore } from '@/state/mapLayerStore';
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
        // Enlarge MapLibre's ambient tile cache (default ~50 MB) so browsed
        // basemap tiles persist and re-panning the same areas issues no repeat
        // MapTiler requests.
        await OfflineManager.setMaximumAmbientCacheSize(256 * 1024 * 1024);
        await useThemeStore.getState().hydrate();
        await useLanguageStore.getState().hydrate();
        await useMapLayerStore.getState().hydrate();
        await seedPoisIfEmpty();
        await restoreRecording();
        // Ads are best-effort and must not block launch; initAds swallows its
        // own errors, and this outer catch covers anything unexpected.
        await initAds();
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
            name="hike/[id]/index"
            options={{ headerShown: true, title: t('nav.hike'), headerBackTitle: t('common.back') }}
          />
          <Stack.Screen
            name="hike/[id]/edit"
            options={{ headerShown: true, title: t('hikeEdit.title'), headerBackTitle: t('common.cancel') }}
          />
          <Stack.Screen
            name="plan"
            options={{ headerShown: true, title: t('plan.title'), headerBackTitle: t('common.back') }}
          />
          <Stack.Screen
            name="offline-maps"
            options={{ headerShown: true, title: t('nav.offlineMaps'), headerBackTitle: t('common.back') }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

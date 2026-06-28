import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MapCanvas } from '@/components/map-canvas';
import { PrimaryButton } from '@/components/primary-button';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { saveOverpassRoute } from '@/data/routeService';
import { getRoute, getRouteWaypoints } from '@/db/routes';
import type { Route, Waypoint } from '@/db/types';
import { boundsOfCoords } from '@/map/mapStyle';
import {
  deleteRegion,
  downloadRegion,
  listDownloadedRegions,
  regionForRoute,
} from '@/map/offlineTiles';
import { useFollowStore } from '@/state/followStore';
import { useRoutePreviewStore } from '@/state/routePreviewStore';
import { formatDistance, formatElevation } from '@/tracking/stats';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [route, setRoute] = useState<Route | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  // Whether this route is persisted in SQLite. A preview (opened from an online
  // search) is not saved until the user downloads its map or follows it.
  const [saved, setSaved] = useState(false);
  const [downloadedPackId, setDownloadedPackId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const refreshDownloaded = useCallback(async () => {
    if (!id) return;
    try {
      const regions = await listDownloadedRegions();
      const pack = regions.find((r) => r.key === `route-${id}`);
      setDownloadedPackId(pack?.id ?? null);
    } catch {
      setDownloadedPackId(null);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const dbRoute = await getRoute(id);
      if (dbRoute) {
        setRoute(dbRoute);
        setSaved(true);
        setWaypoints(await getRouteWaypoints(id));
      } else {
        // Not in SQLite — fall back to the transient online preview.
        const preview = useRoutePreviewStore.getState().preview;
        if (preview && preview.key === id) {
          const { key, ...input } = preview;
          setRoute({ id: key, ...input });
          setSaved(false);
          setWaypoints([]);
        }
      }
      await refreshDownloaded();
    })();
  }, [id, refreshDownloaded]);

  // Persist an online preview to SQLite the first time the user commits to it.
  const ensureSaved = useCallback(async () => {
    if (saved) return;
    const preview = useRoutePreviewStore.getState().preview;
    if (preview && preview.key === id) {
      await saveOverpassRoute(preview);
      setSaved(true);
    }
  }, [saved, id]);

  const onDownload = useCallback(async () => {
    if (!route) return;
    const preset = regionForRoute(route.id, route.name, route.geometry.coordinates);
    if (!preset) {
      Alert.alert(t('routeDetail.cannotDownloadTitle'), t('routeDetail.cannotDownloadMessage'));
      return;
    }
    setDownloading(true);
    setProgress(0);
    try {
      await ensureSaved();
      await downloadRegion(preset, (p) => setProgress(p.percentage));
      await refreshDownloaded();
    } catch (err) {
      Alert.alert(
        t('routeDetail.downloadFailedTitle'),
        err instanceof Error ? err.message : t('routeDetail.unknownError'),
      );
    } finally {
      setDownloading(false);
    }
  }, [route, ensureSaved, refreshDownloaded, t]);

  const onFollow = useCallback(async () => {
    if (!route) return;
    // The Map screen loads the followed route from SQLite by id, so persist first.
    await ensureSaved();
    useFollowStore.getState().follow('route', route.id);
    router.navigate('/(tabs)');
  }, [route, ensureSaved]);

  const onDelete = useCallback(() => {
    if (!downloadedPackId) return;
    Alert.alert(t('routeDetail.deleteOfflineTitle'), t('routeDetail.deleteOfflineMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteRegion(downloadedPackId);
          await refreshDownloaded();
        },
      },
    ]);
  }, [downloadedPackId, refreshDownloaded, t]);

  if (!route) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: route.geometry,
  };

  const bounds = boundsOfCoords(route.geometry.coordinates) ?? undefined;

  const waypointFeatures: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: waypoints.map((w) => ({
      type: 'Feature',
      properties: { name: w.name, kind: w.type },
      geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
    })),
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: route.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapWrap}>
          <MapCanvas bounds={bounds} showUser>
            <GeoJSONSource id="route-line" data={lineFeature}>
              <Layer
                id="route-line-layer"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': '#E5484D', 'line-width': 5 }}
              />
            </GeoJSONSource>
            {waypoints.length > 0 ? (
              <GeoJSONSource id="route-waypoints" data={waypointFeatures}>
                <Layer
                  id="route-waypoints-layer"
                  type="circle"
                  paint={{
                    'circle-radius': 6,
                    'circle-color': '#208AEF',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                  }}
                />
              </GeoJSONSource>
            ) : null}
          </MapCanvas>
        </View>

        <View style={styles.body}>
          {route.region ? (
            <ThemedText type="small" themeColor="textSecondary">
              {route.region}
            </ThemedText>
          ) : null}

          <StatGrid>
            <StatCard label={t('routeDetail.distance')} value={formatDistance(route.distanceM)} />
            <StatCard label={t('routeDetail.ascent')} value={formatElevation(route.ascentM)} />
            <StatCard
              label={t('routeDetail.difficulty')}
              value={route.difficulty ? t(`difficulty.${route.difficulty}`, route.difficulty) : '--'}
            />
          </StatGrid>

          {downloadedPackId ? (
            <ThemedView type="backgroundElement" style={styles.downloadRow}>
              <Ionicons name="checkmark-circle" size={22} color="#30A46C" />
              <ThemedText style={styles.downloadLabel}>{t('routeDetail.offlineReady')}</ThemedText>
              <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button">
                <Ionicons name="trash" size={22} color="#E5484D" />
              </Pressable>
            </ThemedView>
          ) : (
            <Pressable
              onPress={onDownload}
              disabled={downloading}
              accessibilityRole="button"
              style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}>
              {downloading ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <ThemedText style={styles.downloadButtonText}>
                    {t('routeDetail.downloading', { percent: Math.round(progress) })}
                  </ThemedText>
                </>
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <ThemedText style={styles.downloadButtonText}>
                    {t('routeDetail.downloadOfflineMap')}
                  </ThemedText>
                </>
              )}
            </Pressable>
          )}

          <PrimaryButton title={t('routeDetail.followOnMap')} onPress={onFollow} />

          {saved && route.source === 'manual' ? (
            <PrimaryButton
              title={t('routeDetail.editRoute')}
              variant="neutral"
              onPress={() => router.push({ pathname: '/plan', params: { routeId: route.id } })}
            />
          ) : null}

          <ThemedText type="small" themeColor="textSecondary">
            {t('routeDetail.hint')}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: Spacing.six },
  mapWrap: { height: 320 },
  body: { padding: Spacing.four, gap: Spacing.three },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: '#208AEF',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: { opacity: 0.85 },
  downloadButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  downloadLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
});

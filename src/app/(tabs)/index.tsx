import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FollowHud } from '@/components/follow-hud';
import { MapCanvas } from '@/components/map-canvas';
import { MapOverlayLayers } from '@/components/map-overlay-layers';
import { PrimaryButton } from '@/components/primary-button';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getRoute, getRouteWaypoints } from '@/db/routes';
import { getTrack, getTrackPoints } from '@/db/tracks';
import type { TrackPoint, Waypoint } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { formatCoordinate, lastCoordinate, pointsToLineString } from '@/map/mapStyle';
import { useCurrentLocation } from '@/map/use-current-location';
import { useFollowNavigation } from '@/map/use-follow-navigation';
import { useFollowStore } from '@/state/followStore';
import { useRecordingStore } from '@/state/recordingStore';
import { daylight, formatClock } from '@/sun/daylight';
import {
  discardRecording,
  getInitialCoordinate,
  pauseRecording,
  refreshLiveStats,
  resumeRecording,
  startRecording,
  stopRecording,
} from '@/tracking/recorder';
import {
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatElevation,
  formatGpsQuality,
  formatSpeed,
  WARNING_COLOR,
} from '@/tracking/stats';
import { fetchWeather, type WeatherSnapshot } from '@/weather/openMeteo';
import { weatherIcon, weatherLabel } from '@/weather/weatherCodes';

const POLL_INTERVAL_MS = 3000;

/** A path overlaid on the map to follow, normalized from a route or a track. */
interface FollowPath {
  name: string;
  geometry: GeoJSON.LineString;
  waypoints: Waypoint[];
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useTranslation();
  const { trackId, status, startedAt, stats, live } = useRecordingStore();
  const followKind = useFollowStore((s) => s.kind);
  const followId = useFollowStore((s) => s.id);
  const clearFollow = useFollowStore((s) => s.clear);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [followPath, setFollowPath] = useState<FollowPath | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [statsCollapsed, setStatsCollapsed] = useState(true);
  const [hudHeight, setHudHeight] = useState(0);
  // Weather snapshot for the follow-without-recording panel. While recording,
  // the live store already carries weather, so this only fills the gap when
  // following without an active recording.
  const [followWeather, setFollowWeather] = useState<WeatherSnapshot | null>(null);

  const isActive = status === 'recording' || status === 'paused';
  const isFollowing = followPath != null;

  // Load the path to follow (geometry + waypoints) whenever the selection
  // changes — a saved route or one of the user's recorded tracks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!followId || !followKind) {
        if (!cancelled) setFollowPath(null);
        return;
      }
      if (followKind === 'route') {
        const [route, waypoints] = await Promise.all([
          getRoute(followId),
          getRouteWaypoints(followId),
        ]);
        if (cancelled) return;
        setFollowPath(route ? { name: route.name, geometry: route.geometry, waypoints } : null);
      } else {
        const [track, pts] = await Promise.all([getTrack(followId), getTrackPoints(followId)]);
        if (cancelled) return;
        setFollowPath(
          track && pts.length > 1
            ? { name: track.name, geometry: pointsToLineString(pts).geometry, waypoints: [] }
            : null,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [followKind, followId]);

  // On entry, center the map on the user's current location (instead of the
  // Taiwan-wide default) once a fix is available.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const coord = await getInitialCoordinate();
      if (!cancelled && coord) setInitialCenter(coord);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll persisted points + stats while a recording is active.
  useEffect(() => {
    if (!trackId || !isActive) return;
    let cancelled = false;
    const load = async () => {
      const pts = await getTrackPoints(trackId);
      if (!cancelled) setPoints(pts);
      await refreshLiveStats(trackId);
    };
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [trackId, isActive]);

  // Tick the elapsed timer every second while recording.
  useEffect(() => {
    if (status !== 'recording' || !startedAt) return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status, startedAt]);

  // Fetch a one-time weather snapshot while following without recording (the
  // recording flow has its own weather). Best-effort: a single fix + lookup per
  // follow session, silently no-op offline.
  useEffect(() => {
    if (!isFollowing || isActive) return;
    let cancelled = false;
    (async () => {
      setFollowWeather(null);
      const coord = await getInitialCoordinate();
      if (!coord || cancelled) return;
      const weather = await fetchWeather(coord[1], coord[0]);
      if (!cancelled && weather) setFollowWeather(weather);
    })();
    return () => {
      cancelled = true;
    };
  }, [isFollowing, isActive]);

  const last = lastCoordinate(points);
  const liveCoord: [number, number] | null =
    live.lat != null && live.lon != null ? [live.lon, live.lat] : null;

  const handleStart = useCallback(() => {
    Alert.alert(t('map.startTitle'), t('map.startMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.start'),
        onPress: async () => {
          setBusy(true);
          try {
            const name = t('map.hikeName', { date: new Date().toLocaleDateString() });
            // Link the hike to the route being followed, if any, so a manual
            // start mid-follow is associated just like the prompted start.
            const routeId = followKind === 'route' ? followId : null;
            const id = await startRecording(name, routeId);
            if (!id) {
              Alert.alert(t('map.permissionTitle'), t('map.permissionMessage'));
            }
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [t, followKind, followId]);

  const handleFinish = useCallback(() => {
    Alert.alert(t('map.finishTitle'), t('map.finishMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.save'),
        onPress: async () => {
          setBusy(true);
          try {
            const id = await stopRecording();
            if (id) router.push(`/hike/${id}`);
          } finally {
            setBusy(false);
          }
        },
      },
      {
        text: t('common.discard'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await discardRecording();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [t]);

  const liveDuration = status === 'recording' ? Math.max(elapsed, stats.durationS) : stats.durationS;

  // Current coordinates for the top-left readout. While recording the store
  // already holds fresh coords, so the standalone watch only runs otherwise.
  const watched = useCurrentLocation(!isActive);
  const currentCoord: [number, number] | null =
    isActive && live.lat != null && live.lon != null ? [live.lon, live.lat] : watched;

  // Camera center. While recording, follow the latest fix (persisted point, then
  // live sample). While following without recording, center on the user's live
  // position too (heading-up navigation), falling back to the entry center.
  const center = isActive
    ? (last ?? liveCoord ?? initialCenter ?? undefined)
    : isFollowing
      ? (currentCoord ?? initialCenter ?? undefined)
      : (initialCenter ?? undefined);

  // Live route guidance (progress, remaining, ETA, next waypoint, off-route).
  // Decoupled from recording: uses whichever user position is available and, when
  // recording, the moving pace for a better ETA.
  const nav = useFollowNavigation(
    followPath,
    currentCoord,
    isActive ? { distanceM: stats.distanceM, movingTimeS: stats.movingTimeS } : null,
  );

  // Push the map controls and coordinate chip below the follow HUD. The HUD sits
  // at `insets.top + Spacing.two`; its measured height varies (e.g. the off-route
  // row), so offset by the real height rather than a fixed guess.
  const followInset = followPath ? Spacing.two + hudHeight : 0;

  // Sunset / remaining daylight from the latest fix (falling back to the
  // initial center before the first point arrives). `elapsed` ticking each
  // second keeps the countdown fresh.
  const sunLat = live.lat ?? currentCoord?.[1] ?? initialCenter?.[1] ?? null;
  const sunLon = live.lon ?? currentCoord?.[0] ?? initialCenter?.[0] ?? null;
  const sun = sunLat != null && sunLon != null ? daylight(sunLat, sunLon) : null;
  const gps = formatGpsQuality(live.accuracyM);

  // Drag the panel handle down to collapse the stats, up to expand them; a
  // plain tap toggles. Both are purely local UI state and never touch the
  // recorder, so recording continues uninterrupted while the panel opens.
  const DRAG_THRESHOLD = 24;
  const toggleStats = useCallback(() => setStatsCollapsed((c) => !c), []);
  const panelDrag = Gesture.Pan().onUpdate((e) => {
    'worklet';
    // Respond while dragging (not only on release) so the handle feels
    // draggable; the panel's LinearTransition animates the height change.
    // Re-setting the same value is a no-op in React, so this is cheap.
    if (e.translationY > DRAG_THRESHOLD) runOnJS(setStatsCollapsed)(true);
    else if (e.translationY < -DRAG_THRESHOLD) runOnJS(setStatsCollapsed)(false);
  });
  const panelTap = Gesture.Tap().onEnd(() => {
    'worklet';
    runOnJS(toggleStats)();
  });
  const panelGesture = Gesture.Exclusive(panelDrag, panelTap);

  const routeLineFeature: GeoJSON.Feature<GeoJSON.LineString> | null = followPath
    ? { type: 'Feature', properties: {}, geometry: followPath.geometry }
    : null;

  const routeWaypointFeatures: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: (followPath?.waypoints ?? []).map((w) => ({
      type: 'Feature',
      properties: { name: w.name, kind: w.type },
      geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
    })),
  };

  const snappedFeature: GeoJSON.Feature<GeoJSON.Point> | null = nav
    ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: nav.snapped } }
    : null;

  const nextWaypointFeature: GeoJSON.Feature<GeoJSON.Point> | null = nav?.nextWaypoint
    ? {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [nav.nextWaypoint.lon, nav.nextWaypoint.lat] },
      }
    : null;

  return (
    <View style={styles.container}>
      <MapCanvas
        centerCoordinate={center}
        zoomLevel={isActive || isFollowing ? 15 : initialCenter ? 14 : undefined}
        headingUp={isActive || isFollowing}
        showCompass
        showLayers
        userCoordinate={currentCoord ?? undefined}
        showRecenter={!isActive && !isFollowing}
        controlsTopInset={insets.top + followInset}>
        <MapOverlayLayers
          referenceLine={followPath?.geometry.coordinates as [number, number][] | undefined}
          excludeRouteId={followKind === 'route' ? (followId ?? undefined) : undefined}
        />
        {routeLineFeature ? (
          <GeoJSONSource id="follow-route" data={routeLineFeature}>
            <Layer
              id="follow-route-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': nav?.offRoute ? '#FF9500' : '#E5484D', 'line-width': 4 }}
            />
          </GeoJSONSource>
        ) : null}
        {(followPath?.waypoints.length ?? 0) > 0 ? (
          <GeoJSONSource id="follow-route-waypoints" data={routeWaypointFeatures}>
            <Layer
              id="follow-route-waypoints-layer"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': '#E5484D',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
            />
          </GeoJSONSource>
        ) : null}
        {nextWaypointFeature ? (
          <GeoJSONSource id="follow-next-waypoint" data={nextWaypointFeature}>
            <Layer
              id="follow-next-waypoint-layer"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#208AEF',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
              }}
            />
          </GeoJSONSource>
        ) : null}
        {snappedFeature && nav?.offRoute ? (
          // Only while off-route: mark the nearest point on the route. On-route
          // the snapped point sits on the user puck, so it's redundant there.
          <GeoJSONSource id="follow-snapped" data={snappedFeature}>
            <Layer
              id="follow-snapped-layer"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': '#ffffff',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#FF9500',
              }}
            />
          </GeoJSONSource>
        ) : null}
        {isActive && points.length > 1 ? (
          <GeoJSONSource id="active-track" data={pointsToLineString(points)}>
            <Layer
              id="active-track-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#208AEF', 'line-width': 5 }}
            />
          </GeoJSONSource>
        ) : null}
      </MapCanvas>

      {currentCoord ? (
        <ThemedView
          type="backgroundElement"
          style={[styles.coordChip, { top: insets.top + followInset + 12 }]}>
          <Ionicons name="location" size={14} color="#208AEF" />
          <ThemedText type="small">{formatCoordinate(currentCoord[1], currentCoord[0])}</ThemedText>
        </ThemedView>
      ) : null}

      {followPath ? (
        <FollowHud
          name={followPath.name}
          nav={nav}
          topInset={insets.top + Spacing.two}
          onClose={clearFollow}
          onHeightChange={setHudHeight}
        />
      ) : null}

      {isActive ? (
        <Animated.View
          layout={LinearTransition.duration(220)}
          style={[
            styles.panel,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
          ]}>
          <GestureDetector gesture={panelGesture}>
            <View
              style={styles.panelHandle}
              accessibilityRole="adjustable"
              accessibilityLabel={
                statsCollapsed ? t('map.expandStats') : t('map.collapseStats')
              }>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          {statsCollapsed ? (
            <StatGrid>
              <StatCard compact label={t('map.distance')} value={formatDistance(stats.distanceM)} />
              <StatCard compact label={t('map.duration')} value={formatDuration(liveDuration)} />
              <StatCard compact label={t('map.altitude')} value={formatElevation(live.altM)} />
            </StatGrid>
          ) : (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(120)}
              style={styles.statsBlock}>
              <StatGrid>
                <StatCard label={t('map.distance')} value={formatDistance(stats.distanceM)} />
                <StatCard label={t('map.duration')} value={formatDuration(liveDuration)} />
                <StatCard label={t('map.altitude')} value={formatElevation(live.altM)} />
                <StatCard label={t('map.speed')} value={formatSpeed(live.speedMps)} />
                <StatCard label={t('map.ascent')} value={formatElevation(stats.ascentM)} />
                <StatCard
                  label={
                    sun ? t('map.sunset', { time: formatClock(sun.sunsetMs) }) : t('map.daylight')
                  }
                  value={
                    sun
                      ? sun.remainingMs > 0
                        ? t('map.timeLeft', {
                            duration: formatDurationShort(sun.remainingMs / 1000),
                          })
                        : t('map.afterSunset')
                      : '--'
                  }
                  tint={
                    sun && sun.remainingMs <= 0
                      ? WARNING_COLOR
                      : sun?.isLow
                        ? WARNING_COLOR
                        : undefined
                  }
                />
              </StatGrid>
              <StatGrid>
                <StatCard compact icon="locate" label={t('map.gps')} value={gps.label} tint={gps.tint} />
                <StatCard
                  compact
                  icon={live.weatherCode != null ? weatherIcon(live.weatherCode) : 'cloud-offline'}
                  label={live.weatherCode != null ? weatherLabel(live.weatherCode) : t('map.weather')}
                  value={live.weatherTempC != null ? `${Math.round(live.weatherTempC)}°C` : '--'}
                />
              </StatGrid>
            </Animated.View>
          )}
          <View style={styles.row}>
            {status === 'recording' ? (
              <PrimaryButton
                title={t('map.pause')}
                variant="neutral"
                onPress={pauseRecording}
                style={styles.flex}
              />
            ) : (
              <PrimaryButton
                title={t('map.resume')}
                variant="primary"
                onPress={resumeRecording}
                style={styles.flex}
              />
            )}
            <PrimaryButton
              title={t('map.finish')}
              variant="danger"
              onPress={handleFinish}
              loading={busy}
              style={styles.flex}
            />
          </View>
        </Animated.View>
      ) : isFollowing ? (
        // Following without recording: a compact panel with the daylight safety
        // readout and a clear way to start recording (which links this route).
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
          ]}>
          <StatGrid>
            <StatCard
              compact
              icon="partly-sunny"
              label={sun ? t('map.sunset', { time: formatClock(sun.sunsetMs) }) : t('map.daylight')}
              value={
                sun
                  ? sun.remainingMs > 0
                    ? t('map.timeLeft', { duration: formatDurationShort(sun.remainingMs / 1000) })
                    : t('map.afterSunset')
                  : '--'
              }
              tint={sun && (sun.remainingMs <= 0 || sun.isLow) ? WARNING_COLOR : undefined}
            />
            <StatCard
              compact
              icon={followWeather ? weatherIcon(followWeather.code) : 'cloud-offline'}
              label={followWeather ? weatherLabel(followWeather.code) : t('map.weather')}
              value={followWeather ? `${Math.round(followWeather.tempC)}°C` : '--'}
            />
          </StatGrid>
          <View style={styles.row}>
            <PrimaryButton
              title={t('map.startHike')}
              variant="primary"
              onPress={handleStart}
              loading={busy}
              style={styles.flex}
            />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.startHike')}
          onPress={handleStart}
          disabled={busy}
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + Spacing.three, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
          ]}>
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Ionicons name="walk" size={28} color="#ffffff" />
          )}
        </Pressable>
      )}

      {busy ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  coordChip: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.four,
    gap: Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  panelHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
  },
  statsBlock: { gap: Spacing.three },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

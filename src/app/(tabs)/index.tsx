import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, type LngLatBounds, Layer } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapCanvas } from '@/components/map-canvas';
import { PrimaryButton } from '@/components/primary-button';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getRoute, getRouteWaypoints } from '@/db/routes';
import { getTrackPoints } from '@/db/tracks';
import type { Route, TrackPoint, Waypoint } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { boundsOfCoords, formatCoordinate, lastCoordinate, pointsToLineString } from '@/map/mapStyle';
import { useCurrentLocation } from '@/map/use-current-location';
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
import { weatherIcon, weatherLabel } from '@/weather/weatherCodes';

const POLL_INTERVAL_MS = 3000;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { trackId, status, startedAt, stats, live } = useRecordingStore();
  const followRouteId = useFollowStore((s) => s.routeId);
  const clearFollow = useFollowStore((s) => s.clear);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [followRoute, setFollowRoute] = useState<Route | null>(null);
  const [followWaypoints, setFollowWaypoints] = useState<Waypoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [statsCollapsed, setStatsCollapsed] = useState(true);

  const isActive = status === 'recording' || status === 'paused';

  // Load the route to follow (geometry + waypoints) whenever the selection changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!followRouteId) {
        if (!cancelled) {
          setFollowRoute(null);
          setFollowWaypoints([]);
        }
        return;
      }
      const [route, waypoints] = await Promise.all([
        getRoute(followRouteId),
        getRouteWaypoints(followRouteId),
      ]);
      if (cancelled) return;
      setFollowRoute(route);
      setFollowWaypoints(waypoints);
    })();
    return () => {
      cancelled = true;
    };
  }, [followRouteId]);

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

  const last = lastCoordinate(points);
  const liveCoord: [number, number] | null =
    live.lat != null && live.lon != null ? [live.lon, live.lat] : null;
  // While recording, follow the latest fix (prefer the persisted point, falling
  // back to the live sample, then the entry center); otherwise (and when not
  // framing a route) center on the user's current location.
  const center = isActive
    ? (last ?? liveCoord ?? initialCenter ?? undefined)
    : (initialCenter ?? undefined);

  // Before recording, frame the whole route to follow; once recording, the
  // camera tracks the user (centerCoordinate) so the route line scrolls past.
  const followBounds: LngLatBounds | undefined =
    !isActive && followRoute
      ? (boundsOfCoords(followRoute.geometry.coordinates) ?? undefined)
      : undefined;

  const handleStart = useCallback(() => {
    Alert.alert('Start hike?', 'Begin recording your route, distance, and elevation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          setBusy(true);
          try {
            const name = `Hike ${new Date().toLocaleDateString()}`;
            const id = await startRecording(name);
            if (!id) {
              Alert.alert(
                'Location permission needed',
                'Hiker needs location access to record your hike. Please enable it in Settings.',
              );
            }
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, []);

  const handleFinish = useCallback(() => {
    Alert.alert('Finish hike?', 'Save this hike to your journal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
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
        text: 'Discard',
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
  }, []);

  const liveDuration = status === 'recording' ? Math.max(elapsed, stats.durationS) : stats.durationS;

  // Current coordinates for the top-left readout. While recording the store
  // already holds fresh coords, so the standalone watch only runs otherwise.
  const watched = useCurrentLocation(!isActive);
  const currentCoord: [number, number] | null =
    isActive && live.lat != null && live.lon != null ? [live.lon, live.lat] : watched;

  // Sunset / remaining daylight from the latest fix (falling back to the
  // initial center before the first point arrives). `elapsed` ticking each
  // second keeps the countdown fresh.
  const sunLat = live.lat ?? initialCenter?.[1] ?? null;
  const sunLon = live.lon ?? initialCenter?.[0] ?? null;
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

  const routeLineFeature: GeoJSON.Feature<GeoJSON.LineString> | null = followRoute
    ? { type: 'Feature', properties: {}, geometry: followRoute.geometry }
    : null;

  const routeWaypointFeatures: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: followWaypoints.map((w) => ({
      type: 'Feature',
      properties: { name: w.name, kind: w.type },
      geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
    })),
  };

  return (
    <View style={styles.container}>
      <MapCanvas
        centerCoordinate={center}
        zoomLevel={isActive ? 15 : initialCenter ? 14 : undefined}
        bounds={followBounds}
        headingUp={isActive}
        showCompass
        controlsTopInset={insets.top + (followRoute ? 56 : 0)}>
        {routeLineFeature ? (
          <GeoJSONSource id="follow-route" data={routeLineFeature}>
            <Layer
              id="follow-route-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#E5484D', 'line-width': 4 }}
            />
          </GeoJSONSource>
        ) : null}
        {followWaypoints.length > 0 ? (
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
          style={[styles.coordChip, { top: insets.top + (followRoute ? 56 : 0) + 12 }]}>
          <Ionicons name="location" size={14} color="#208AEF" />
          <ThemedText type="small">{formatCoordinate(currentCoord[1], currentCoord[0])}</ThemedText>
        </ThemedView>
      ) : null}

      {followRoute ? (
        <ThemedView
          type="backgroundElement"
          style={[styles.followBanner, { top: insets.top + Spacing.two }]}>
          <Ionicons name="trail-sign" size={18} color="#E5484D" />
          <View style={styles.followBannerText}>
            <ThemedText type="small" themeColor="textSecondary">
              Following
            </ThemedText>
            <ThemedText style={styles.followBannerName} numberOfLines={1}>
              {followRoute.name}
            </ThemedText>
          </View>
          <Pressable
            onPress={clearFollow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Stop following route">
            <Ionicons name="close-circle" size={24} color="#6B7280" />
          </Pressable>
        </ThemedView>
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
                statsCollapsed ? 'Tap or drag up to expand stats' : 'Tap or drag down to collapse stats'
              }>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          {statsCollapsed ? (
            <StatGrid>
              <StatCard compact label="Distance" value={formatDistance(stats.distanceM)} />
              <StatCard compact label="Duration" value={formatDuration(liveDuration)} />
              <StatCard compact label="Altitude" value={formatElevation(live.altM)} />
            </StatGrid>
          ) : (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(120)}
              style={styles.statsBlock}>
              <StatGrid>
                <StatCard label="Distance" value={formatDistance(stats.distanceM)} />
                <StatCard label="Duration" value={formatDuration(liveDuration)} />
                <StatCard label="Altitude" value={formatElevation(live.altM)} />
                <StatCard label="Speed" value={formatSpeed(live.speedMps)} />
                <StatCard label="Ascent" value={formatElevation(stats.ascentM)} />
                <StatCard
                  label={sun ? `Sunset ${formatClock(sun.sunsetMs)}` : 'Daylight'}
                  value={
                    sun
                      ? sun.remainingMs > 0
                        ? `${formatDurationShort(sun.remainingMs / 1000)} left`
                        : 'After sunset'
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
                <StatCard compact icon="locate" label="GPS" value={gps.label} tint={gps.tint} />
                <StatCard
                  compact
                  icon={live.weatherCode != null ? weatherIcon(live.weatherCode) : 'cloud-offline'}
                  label={live.weatherCode != null ? weatherLabel(live.weatherCode) : 'Weather'}
                  value={live.weatherTempC != null ? `${Math.round(live.weatherTempC)}°C` : '--'}
                />
              </StatGrid>
            </Animated.View>
          )}
          <View style={styles.row}>
            {status === 'recording' ? (
              <PrimaryButton
                title="Pause"
                variant="neutral"
                onPress={pauseRecording}
                style={styles.flex}
              />
            ) : (
              <PrimaryButton
                title="Resume"
                variant="primary"
                onPress={resumeRecording}
                style={styles.flex}
              />
            )}
            <PrimaryButton
              title="Finish"
              variant="danger"
              onPress={handleFinish}
              loading={busy}
              style={styles.flex}
            />
          </View>
        </Animated.View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start hike"
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
  followBanner: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  followBannerText: { flex: 1 },
  followBannerName: { fontSize: 16, fontWeight: '600' },
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

import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapCanvas } from '@/components/map-canvas';
import { PrimaryButton } from '@/components/primary-button';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getTrackPoints } from '@/db/tracks';
import type { TrackPoint } from '@/db/types';
import { lastCoordinate, pointsToLineString } from '@/map/mapStyle';
import { useRecordingStore } from '@/state/recordingStore';
import {
  discardRecording,
  pauseRecording,
  refreshLiveStats,
  resumeRecording,
  startRecording,
  stopRecording,
} from '@/tracking/recorder';
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/tracking/stats';

const POLL_INTERVAL_MS = 3000;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { trackId, status, startedAt, stats } = useRecordingStore();
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const isActive = status === 'recording' || status === 'paused';

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
  const center = isActive ? (last ?? undefined) : undefined;

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

  return (
    <View style={styles.container}>
      <MapCanvas centerCoordinate={center} zoomLevel={isActive ? 15 : undefined}>
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

      {isActive ? (
        <ThemedView style={[styles.panel, { paddingBottom: insets.bottom + Spacing.three }]}>
          <StatGrid>
            <StatCard label="Distance" value={formatDistance(stats.distanceM)} />
            <StatCard label="Duration" value={formatDuration(liveDuration)} />
            <StatCard label="Ascent" value={formatElevation(stats.ascentM)} />
            <StatCard label="Pace" value={formatPace(stats.distanceM, liveDuration)} />
          </StatGrid>
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
        </ThemedView>
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

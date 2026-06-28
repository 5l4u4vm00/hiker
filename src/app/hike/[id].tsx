import { GeoJSONSource, type LngLatBounds, Layer } from '@maplibre/maplibre-react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MapCanvas } from '@/components/map-canvas';
import { PrimaryButton } from '@/components/primary-button';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { addJournalEntry, getJournalEntries } from '@/db/journal';
import { deleteTrack, getTrack, getTrackPoints } from '@/db/tracks';
import type { JournalEntry, Track, TrackPoint } from '@/db/types';
import { shareTrackAsGpx } from '@/gpx/export';
import { useTheme } from '@/hooks/use-theme';
import { pointsToLineString } from '@/map/mapStyle';
import { useFollowStore } from '@/state/followStore';
import { daylight, formatClock } from '@/sun/daylight';
import {
  computeStats,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
} from '@/tracking/stats';
import { weatherIcon, weatherLabel } from '@/weather/weatherCodes';

function boundsOf(points: TrackPoint[]): LngLatBounds | null {
  if (points.length === 0) return null;
  let west = points[0].lon;
  let east = points[0].lon;
  let south = points[0].lat;
  let north = points[0].lat;
  for (const p of points) {
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return [west, south, east, north];
}

export default function HikeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const [track, setTrack] = useState<Track | null>(null);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      setTrack(await getTrack(id));
      setPoints(await getTrackPoints(id));
      setEntries(await getJournalEntries(id));
    })();
  }, [id]);

  const onAddNote = async () => {
    if (!id || !note.trim()) return;
    const entry = await addJournalEntry(id, note.trim());
    setEntries((prev) => [entry, ...prev]);
    setNote('');
  };

  const onExport = async () => {
    if (track) await shareTrackAsGpx(track, points);
  };

  const onFollow = () => {
    if (!id) return;
    useFollowStore.getState().follow('track', id);
    router.navigate('/(tabs)');
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert(t('hikeDetail.deleteTitle'), t('hikeDetail.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTrack(id);
          router.back();
        },
      },
    ]);
  };

  if (!track) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  // Moving time and max speed aren't persisted; recompute them from the points
  // already loaded for the map (cheap, and keeps the tracks schema lean).
  const extended = computeStats(points);
  const avgMovingSpeed = extended.movingTimeS >= 1 ? extended.distanceM / extended.movingTimeS : null;
  const startSun =
    points.length > 0 ? daylight(points[0].lat, points[0].lon, track.startedAt) : null;
  const bounds = boundsOf(points) ?? undefined;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: track.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapWrap}>
          <MapCanvas bounds={bounds} showUser={false}>
            {points.length > 1 ? (
              <GeoJSONSource id="hike-track" data={pointsToLineString(points)}>
                <Layer
                  id="hike-track-line"
                  type="line"
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{ 'line-color': '#208AEF', 'line-width': 5 }}
                />
              </GeoJSONSource>
            ) : null}
          </MapCanvas>
        </View>

        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateTime(track.startedAt)}
          </ThemedText>

          <StatGrid>
            <StatCard label={t('hikeDetail.distance')} value={formatDistance(track.distanceM)} />
            <StatCard label={t('hikeDetail.duration')} value={formatDuration(track.durationS)} />
            <StatCard label={t('hikeDetail.movingTime')} value={formatDuration(extended.movingTimeS)} />
            <StatCard label={t('hikeDetail.ascent')} value={formatElevation(track.ascentM)} />
            <StatCard label={t('hikeDetail.descent')} value={formatElevation(track.descentM)} />
            <StatCard label={t('hikeDetail.maxAlt')} value={formatElevation(track.maxAlt)} />
            <StatCard label={t('hikeDetail.avgSpeed')} value={formatSpeed(avgMovingSpeed)} />
            <StatCard label={t('hikeDetail.maxSpeed')} value={formatSpeed(extended.maxSpeed)} />
            <StatCard label={t('hikeDetail.pace')} value={formatPace(track.distanceM, track.durationS)} />
            {startSun ? (
              <StatCard label={t('hikeDetail.sunset')} value={formatClock(startSun.sunsetMs)} />
            ) : null}
            {track.weatherCode != null ? (
              <StatCard
                icon={weatherIcon(track.weatherCode)}
                label={weatherLabel(track.weatherCode)}
                value={track.weatherTempC != null ? `${Math.round(track.weatherTempC)}°C` : '--'}
              />
            ) : null}
          </StatGrid>

          {points.length > 1 ? (
            <PrimaryButton title={t('hikeDetail.followOnMap')} onPress={onFollow} />
          ) : null}

          <ThemedText style={styles.sectionTitle}>{t('hikeDetail.notes')}</ThemedText>
          <View style={styles.noteRow}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('hikeDetail.notePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.noteInput, { color: theme.text, borderColor: theme.textSecondary }]}
            />
          </View>
          <PrimaryButton title={t('hikeDetail.addNote')} variant="neutral" onPress={onAddNote} />

          {entries.map((e) => (
            <ThemedView key={e.id} type="backgroundElement" style={styles.entry}>
              <ThemedText>{e.note}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDateTime(e.createdAt)}
              </ThemedText>
            </ThemedView>
          ))}

          <View style={styles.actions}>
            <PrimaryButton title={t('hikeDetail.exportGpx')} onPress={onExport} style={styles.flex} />
            <PrimaryButton
              title={t('common.delete')}
              variant="danger"
              onPress={onDelete}
              style={styles.flex}
            />
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: Spacing.six },
  mapWrap: { height: 280 },
  body: { padding: Spacing.four, gap: Spacing.three },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.two },
  noteRow: { flexDirection: 'row' },
  noteInput: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  entry: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  flex: { flex: 1 },
});

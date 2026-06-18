import { GeoJSONSource, type CameraRef, Layer } from '@maplibre/maplibre-react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
} from '@/tracking/stats';

function boundsOf(points: TrackPoint[]): [number, number, number, number] | null {
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
  const [track, setTrack] = useState<Track | null>(null);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [note, setNote] = useState('');
  const cameraRef = useRef<CameraRef>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setTrack(await getTrack(id));
      setPoints(await getTrackPoints(id));
      setEntries(await getJournalEntries(id));
    })();
  }, [id]);

  useEffect(() => {
    const bounds = boundsOf(points);
    if (bounds && cameraRef.current) {
      cameraRef.current.fitBounds([bounds[0], bounds[1], bounds[2], bounds[3]], {
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
        duration: 600,
      });
    }
  }, [points]);

  const onAddNote = async () => {
    if (!id || !note.trim()) return;
    const entry = await addJournalEntry(id, note.trim());
    setEntries((prev) => [entry, ...prev]);
    setNote('');
  };

  const onExport = async () => {
    if (track) await shareTrackAsGpx(track, points);
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert('Delete hike?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: track.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapWrap}>
          <MapCanvas ref={cameraRef} showUser={false}>
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
            <StatCard label="Distance" value={formatDistance(track.distanceM)} />
            <StatCard label="Duration" value={formatDuration(track.durationS)} />
            <StatCard label="Ascent" value={formatElevation(track.ascentM)} />
            <StatCard label="Descent" value={formatElevation(track.descentM)} />
            <StatCard label="Max alt" value={formatElevation(track.maxAlt)} />
            <StatCard label="Pace" value={formatPace(track.distanceM, track.durationS)} />
          </StatGrid>

          <ThemedText style={styles.sectionTitle}>Notes</ThemedText>
          <View style={styles.noteRow}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note about this hike"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.noteInput, { color: theme.text, borderColor: theme.textSecondary }]}
            />
          </View>
          <PrimaryButton title="Add note" variant="neutral" onPress={onAddNote} />

          {entries.map((e) => (
            <ThemedView key={e.id} type="backgroundElement" style={styles.entry}>
              <ThemedText>{e.note}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDateTime(e.createdAt)}
              </ThemedText>
            </ThemedView>
          ))}

          <View style={styles.actions}>
            <PrimaryButton title="Export GPX" onPress={onExport} style={styles.flex} />
            <PrimaryButton title="Delete" variant="danger" onPress={onDelete} style={styles.flex} />
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

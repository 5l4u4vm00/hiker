import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, type LngLatBounds, Layer } from '@maplibre/maplibre-react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MapCanvas } from '@/components/map-canvas';
import { PrimaryButton } from '@/components/primary-button';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getJournalEntries } from '@/db/journal';
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

const ACCENT = '#208AEF';

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

  // Reload on focus so edits made on the edit screen show on return.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      (async () => {
        setTrack(await getTrack(id));
        setPoints(await getTrackPoints(id));
        setEntries(await getJournalEntries(id));
      })();
    }, [id]),
  );

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
      <Stack.Screen
        options={{
          title: track.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/hike/[id]/edit', params: { id } })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('hikeDetail.edit')}
              style={styles.headerEdit}>
              <Ionicons name="create-outline" size={20} color={ACCENT} />
              <ThemedText style={styles.headerEditLabel}>{t('hikeDetail.edit')}</ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapWrap}>
          <MapCanvas bounds={bounds} showUser={false}>
            {points.length > 1 ? (
              <GeoJSONSource id="hike-track" data={pointsToLineString(points)}>
                <Layer
                  id="hike-track-line"
                  type="line"
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{ 'line-color': ACCENT, 'line-width': 5 }}
                />
              </GeoJSONSource>
            ) : null}
          </MapCanvas>
        </View>

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>{track.name}</ThemedText>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateTime(track.startedAt)}
                </ThemedText>
              </View>
              {track.weatherCode != null ? (
                <View style={[styles.weatherChip, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name={weatherIcon(track.weatherCode)} size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {weatherLabel(track.weatherCode)}
                    {track.weatherTempC != null ? ` · ${Math.round(track.weatherTempC)}°C` : ''}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <StatGrid>
            <StatCard label={t('hikeDetail.distance')} value={formatDistance(track.distanceM)} />
            <StatCard label={t('hikeDetail.duration')} value={formatDuration(track.durationS)} />
            <StatCard label={t('hikeDetail.ascent')} value={formatElevation(track.ascentM)} />
          </StatGrid>

          <StatGrid>
            <StatCard compact label={t('hikeDetail.movingTime')} value={formatDuration(extended.movingTimeS)} />
            <StatCard compact label={t('hikeDetail.descent')} value={formatElevation(track.descentM)} />
            <StatCard compact label={t('hikeDetail.maxAlt')} value={formatElevation(track.maxAlt)} />
            <StatCard compact label={t('hikeDetail.avgSpeed')} value={formatSpeed(avgMovingSpeed)} />
            <StatCard compact label={t('hikeDetail.maxSpeed')} value={formatSpeed(extended.maxSpeed)} />
            <StatCard compact label={t('hikeDetail.pace')} value={formatPace(track.distanceM, track.durationS)} />
            {startSun ? (
              <StatCard compact label={t('hikeDetail.sunset')} value={formatClock(startSun.sunsetMs)} />
            ) : null}
          </StatGrid>

          {points.length > 1 ? (
            <PrimaryButton title={t('hikeDetail.followOnMap')} onPress={onFollow} />
          ) : null}

          <View style={styles.notesHeader}>
            <ThemedText style={styles.sectionTitle}>{t('hikeDetail.notes')}</ThemedText>
            {entries.length > 0 ? (
              <View style={styles.noteBadge}>
                <Ionicons name="document-text-outline" size={14} color={ACCENT} />
                <ThemedText type="small" style={styles.noteBadgeLabel}>
                  {t('journal.notesCount', { count: entries.length })}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {entries.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('hikeDetail.noNotes')}
            </ThemedText>
          ) : (
            entries.map((e) => (
              <ThemedView key={e.id} type="backgroundElement" style={styles.entry}>
                <ThemedText>{e.note}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateTime(e.createdAt)}
                </ThemedText>
              </ThemedView>
            ))
          )}

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
  headerEdit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  headerEditLabel: { color: ACCENT, fontSize: 16 },
  mapWrap: { height: 280 },
  body: { padding: Spacing.four, gap: Spacing.three },
  titleBlock: { gap: Spacing.two },
  title: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  noteBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  noteBadgeLabel: { color: ACCENT, fontWeight: '600' },
  entry: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  flex: { flex: 1 },
});

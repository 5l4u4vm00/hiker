import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listCompletedTracks } from '@/db/tracks';
import type { Track } from '@/db/types';
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/tracking/stats';

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);

  useFocusEffect(
    useCallback(() => {
      listCompletedTracks().then(setTracks);
    }, []),
  );

  const totals = useMemo(() => {
    return tracks.reduce(
      (acc, t) => ({
        distanceM: acc.distanceM + t.distanceM,
        ascentM: acc.ascentM + t.ascentM,
        count: acc.count + 1,
      }),
      { distanceM: 0, ascentM: 0, count: 0 },
    );
  }, [tracks]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <ThemedText type="subtitle" style={styles.heading}>
        Journal
      </ThemedText>

      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six, gap: Spacing.two }}
        ListHeaderComponent={
          <View style={styles.summary}>
            <StatGrid>
              <StatCard label="Hikes" value={String(totals.count)} />
              <StatCard label="Total distance" value={formatDistance(totals.distanceM)} />
              <StatCard label="Total ascent" value={formatElevation(totals.ascentM)} />
            </StatGrid>
          </View>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            No hikes yet. Record one from the Map tab to see it here.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/hike/${item.id}`)}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDate(item.startedAt)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDistance(item.distanceM)} · {formatDuration(item.durationS)} ·{' '}
                {formatElevation(item.ascentM)} ascent
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four },
  heading: { marginBottom: Spacing.three },
  summary: { marginBottom: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: Spacing.five },
});

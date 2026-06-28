import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        {t('journal.title')}
      </ThemedText>

      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six, gap: Spacing.two }}
        ListHeaderComponent={
          <View style={styles.summary}>
            <StatGrid>
              <StatCard label={t('journal.hikes')} value={String(totals.count)} />
              <StatCard label={t('journal.totalDistance')} value={formatDistance(totals.distanceM)} />
              <StatCard label={t('journal.totalAscent')} value={formatElevation(totals.ascentM)} />
            </StatGrid>
          </View>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {t('journal.empty')}
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
                {t('journal.trackStats', {
                  distance: formatDistance(item.distanceM),
                  duration: formatDuration(item.durationS),
                  ascent: formatElevation(item.ascentM),
                })}
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

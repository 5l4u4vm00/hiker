import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { queryJournalTracks, type JournalTrack } from '@/db/tracks';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/tracking/stats';

const ACCENT = '#208AEF';

type JournalSection = { title: string; data: JournalTrack[] };

/** Groups completed hikes (already sorted newest-first) into month/year sections. */
function groupByMonth(entries: JournalTrack[], locale: string): JournalSection[] {
  const formatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  const sections: JournalSection[] = [];
  for (const entry of entries) {
    const title = formatter.format(new Date(entry.track.startedAt));
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(entry);
    } else {
      sections.push({ title, data: [entry] });
    }
  }
  return sections;
}

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<JournalTrack[]>([]);
  const [query, setQuery] = useState('');
  // Mirror the query so the focus effect can reload without re-firing on each keystroke.
  const queryRef = useRef(query);

  const reload = useCallback((keyword: string) => {
    queryJournalTracks(keyword).then(setEntries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload(queryRef.current);
    }, [reload]),
  );

  const onSearch = useCallback(
    (text: string) => {
      setQuery(text);
      queryRef.current = text;
      reload(text);
    },
    [reload],
  );

  const onClear = useCallback(() => {
    setQuery('');
    queryRef.current = '';
    reload('');
  }, [reload]);

  const searching = query.trim().length > 0;
  const sections = groupByMonth(entries, i18n.language);

  const totals = entries.reduce(
    (acc, e) => ({
      distanceM: acc.distanceM + e.track.distanceM,
      ascentM: acc.ascentM + e.track.ascentM,
      count: acc.count + 1,
    }),
    { distanceM: 0, ascentM: 0, count: 0 },
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <ThemedText type="subtitle">{t('journal.title')}</ThemedText>

      <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onSearch}
          placeholder={t('journal.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {query.length > 0 ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('journal.clearSearch')}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.track.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six, gap: Spacing.two }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          searching ? null : (
            <View style={styles.summary}>
              <StatGrid>
                <StatCard label={t('journal.hikes')} value={String(totals.count)} />
                <StatCard label={t('journal.totalDistance')} value={formatDistance(totals.distanceM)} />
                <StatCard label={t('journal.totalAscent')} value={formatElevation(totals.ascentM)} />
              </StatGrid>
            </View>
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={40} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {searching ? t('journal.noResults') : t('journal.empty')}
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/hike/${item.track.id}`)}>
            <JournalCard entry={item} />
          </Pressable>
        )}
      />

      <AdBanner />
    </ThemedView>
  );
}

function JournalCard({ entry }: { entry: JournalTrack }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { track, noteCount, latestNote } = entry;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.cardTitle}>{track.name}</ThemedText>
        {noteCount > 0 ? (
          <View style={styles.noteBadge}>
            <Ionicons name="document-text-outline" size={14} color={ACCENT} />
            <ThemedText type="small" style={styles.noteBadgeLabel}>
              {t('journal.notesCount', { count: noteCount })}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(track.startedAt)}
        </ThemedText>
      </View>

      <View style={styles.statRow}>
        <Stat icon="swap-horizontal" value={formatDistance(track.distanceM)} />
        <Stat icon="time-outline" value={formatDuration(track.durationS)} />
        <Stat icon="trending-up" value={formatElevation(track.ascentM)} />
      </View>

      {latestNote ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {latestNote}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

/** A compact icon/value pair used in a journal card's stat row. */
function Stat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16 },
  summary: { marginBottom: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    gap: Spacing.two,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  noteBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  noteBadgeLabel: { color: ACCENT, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three },
  stat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  empty: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center', paddingHorizontal: Spacing.four },
});

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  searchRoutesByName,
  searchRoutesNearby,
  type OverpassQueryError,
  type OverpassResult,
  type OverpassRouteResult,
} from '@/data/overpass';
import { listRegions, queryRoutes } from '@/db/routes';
import type { Route } from '@/db/types';
import { importGpxFromPicker } from '@/gpx/import';
import { listDownloadedRegions } from '@/map/offlineTiles';
import { useRoutePreviewStore } from '@/state/routePreviewStore';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentCoordinates } from '@/safety/sos';
import { formatDistance, formatElevation, nearestPointDistanceM } from '@/tracking/stats';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#30A46C',
  moderate: '#F5A623',
  hard: '#E5484D',
  expert: '#8E4EC6',
};

/** Card accent for routes without a graded difficulty. */
const NEUTRAL_ACCENT = '#6B7280';
const ACCENT = '#208AEF';
const SUCCESS = '#30A46C';

/** Minimum query length before an online search fires (keeps Overpass load down). */
const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 500;

type RouteListItem = Route | OverpassRouteResult;
type RouteSection = { kind: 'saved' | 'osm'; title: string; data: RouteListItem[] };

function errorMessage(error: OverpassQueryError, t: TFunction): string {
  switch (error.kind) {
    case 'network':
      return t('routes.errNetwork');
    case 'rate-limit':
      return t('routes.errRateLimit');
    case 'server':
      return t('routes.errServer');
  }
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  // Ids of saved routes whose offline tile pack is already downloaded.
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // Live online search (transient — only persisted when the user opens one).
  const [liveResults, setLiveResults] = useState<OverpassRouteResult[]>([]);
  const [liveActive, setLiveActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<OverpassQueryError | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Mirror the filters so the focus effect can reload without re-firing on each keystroke.
  const filtersRef = useRef({ query, region });
  const hasLocation = useRef(false);
  // Monotonic token so a newer search supersedes any older in-flight response.
  const searchToken = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async (keyword: string, regionFilter: string | null) => {
    const data = await queryRoutes({ keyword, region: regionFilter ?? undefined });
    setRoutes(data);
    setRegions(await listRegions());
  }, []);

  // Map downloaded tile packs (keyed `route-<id>`) back to route ids so the list
  // can flag which saved routes already work offline.
  const loadDownloaded = useCallback(async () => {
    const packs = await listDownloadedRegions();
    setDownloadedIds(
      new Set(
        packs
          .map((p) => p.key)
          .filter((k) => k.startsWith('route-'))
          .map((k) => k.slice('route-'.length)),
      ),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      const { query: q, region: r } = filtersRef.current;
      reload(q, r);
      loadDownloaded();
      // Acquire the location fix only once so typing never re-prompts.
      if (!hasLocation.current) {
        hasLocation.current = true;
        getCurrentCoordinates().then((coords) => {
          if (coords) setOrigin({ lat: coords.lat, lon: coords.lon });
        });
      }
    }, [reload, loadDownloaded]),
  );

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  // Runs an online search, ignoring responses that a newer request superseded.
  const runSearch = useCallback(async (fn: () => Promise<OverpassResult>) => {
    const token = ++searchToken.current;
    setLiveActive(true);
    setSearching(true);
    setSearchError(null);
    const result = await fn();
    if (token !== searchToken.current) return;
    setSearching(false);
    if (result.ok) {
      setLiveResults(result.results);
    } else {
      setLiveResults([]);
      setSearchError(result.error);
    }
  }, []);

  const clearLiveSearch = useCallback(() => {
    searchToken.current++; // cancel any in-flight response
    setLiveActive(false);
    setSearching(false);
    setLiveResults([]);
    setSearchError(null);
  }, []);

  const onSearch = useCallback(
    (text: string) => {
      setQuery(text);
      filtersRef.current = { ...filtersRef.current, query: text };
      reload(text, region);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const trimmed = text.trim();
      if (trimmed.length < MIN_SEARCH_LENGTH) {
        clearLiveSearch();
        return;
      }
      debounceTimer.current = setTimeout(() => {
        runSearch(() => searchRoutesByName(trimmed));
      }, SEARCH_DEBOUNCE_MS);
    },
    [reload, region, runSearch, clearLiveSearch],
  );

  const onSelectRegion = useCallback(
    (next: string | null) => {
      setRegion(next);
      filtersRef.current = { ...filtersRef.current, region: next };
      reload(query, next);
    },
    [reload, query],
  );

  const onNearby = useCallback(async () => {
    let coords = origin;
    if (!coords) {
      const fix = await getCurrentCoordinates();
      if (fix) {
        coords = { lat: fix.lat, lon: fix.lon };
        setOrigin(coords);
      }
    }
    if (!coords) {
      Alert.alert(t('routes.locationNeededTitle'), t('routes.locationNeededMessage'));
      return;
    }
    runSearch(() => searchRoutesNearby(coords!));
  }, [origin, runSearch, t]);

  const onImport = useCallback(async () => {
    try {
      const route = await importGpxFromPicker();
      if (route) {
        await reload(query, region);
        Alert.alert(t('routes.importedTitle'), t('routes.importedMessage', { name: route.name }));
      }
    } catch (err) {
      Alert.alert(
        t('routes.importFailedTitle'),
        err instanceof Error ? err.message : t('routes.importFailedMessage'),
      );
    }
  }, [reload, query, region, t]);

  // Rare actions live behind an overflow menu so the header stays uncluttered.
  const onMore = useCallback(() => {
    Alert.alert(t('routes.moreActions'), undefined, [
      { text: t('routes.importGpxFromFile'), onPress: onImport },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [onImport, t]);

  const onClear = useCallback(() => {
    setQuery('');
    filtersRef.current = { ...filtersRef.current, query: '' };
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    clearLiveSearch();
    reload('', region);
  }, [clearLiveSearch, reload, region]);

  // Preview a live result without saving it — the detail screen renders the
  // in-memory preview and only persists it on download or follow.
  const onOpenLive = useCallback((result: OverpassRouteResult) => {
    useRoutePreviewStore.getState().setPreview(result);
    router.push(`/route/${result.key}`);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (liveActive) {
      const trimmed = query.trim();
      if (trimmed.length >= MIN_SEARCH_LENGTH) {
        await runSearch(() => searchRoutesByName(trimmed));
      }
    } else {
      await reload(query, region);
    }
    await loadDownloaded();
    setRefreshing(false);
  }, [liveActive, query, region, reload, runSearch, loadDownloaded]);

  // Sort saved routes by proximity when a location fix is available.
  const sortedSaved = origin
    ? [...routes].sort(
        (a, b) =>
          nearestPointDistanceM(origin, a.geometry.coordinates) -
          nearestPointDistanceM(origin, b.geometry.coordinates),
      )
    : routes;

  // Hide live results that are already saved, then proximity-sort.
  const savedIds = new Set(routes.map((r) => r.id));
  const liveFiltered = liveResults.filter((r) => !savedIds.has(r.key));
  const sortedLive = origin
    ? [...liveFiltered].sort(
        (a, b) =>
          nearestPointDistanceM(origin, a.geometry.coordinates) -
          nearestPointDistanceM(origin, b.geometry.coordinates),
      )
    : liveFiltered;

  const sections: RouteSection[] = [
    { kind: 'saved', title: t('routes.saved'), data: sortedSaved },
  ];
  if (liveActive) {
    sections.push({ kind: 'osm', title: t('routes.fromOsm'), data: sortedLive });
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{t('routes.title')}</ThemedText>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/plan')}
            style={styles.planButton}
            accessibilityRole="button"
            accessibilityLabel={t('routes.planRoute')}>
            <Ionicons name="add" size={18} color="#ffffff" />
            <ThemedText style={styles.planLabel}>{t('routes.planRoute')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={onMore}
            hitSlop={8}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('routes.moreActions')}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
        {searching ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <Ionicons name="search" size={18} color={theme.textSecondary} />
        )}
        <TextInput
          value={query}
          onChangeText={onSearch}
          placeholder={t('routes.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {query.length > 0 ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('routes.clearSearch')}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onNearby}
          hitSlop={8}
          style={[styles.nearMeButton, { borderLeftColor: theme.backgroundSelected }]}
          accessibilityRole="button"
          accessibilityLabel={t('routes.nearMe')}>
          <Ionicons name="navigate" size={15} color={ACCENT} />
          <ThemedText type="small" style={styles.nearMeLabel}>
            {t('routes.nearMe')}
          </ThemedText>
        </Pressable>
      </View>

      {regions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          <RegionChip
            label={t('routes.all')}
            selected={region === null}
            onPress={() => onSelectRegion(null)}
            theme={theme}
          />
          {regions.map((r) => (
            <RegionChip
              key={r}
              label={r}
              selected={region === r}
              onPress={() => onSelectRegion(r)}
              theme={theme}
            />
          ))}
        </ScrollView>
      ) : null}

      {searchError ? (
        <View style={[styles.banner, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
            {errorMessage(searchError, t)}
          </ThemedText>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => ('id' in item ? item.id : item.key)}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six, gap: Spacing.two }}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
            {section.kind === 'osm' && searching ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : null}
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.kind === 'osm' && !searching && section.data.length === 0 && !searchError ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionEmpty}>
              {t('routes.noOnlineResults')}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trail-sign-outline" size={40} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('routes.noSavedRoutes')}
            </ThemedText>
          </View>
        }
        renderItem={({ item, section }) => (
          <Pressable
            onPress={() =>
              section.kind === 'osm'
                ? onOpenLive(item as OverpassRouteResult)
                : router.push(`/route/${(item as Route).id}`)
            }>
            <RouteCard
              item={item}
              origin={origin}
              live={section.kind === 'osm'}
              downloaded={section.kind === 'saved' && downloadedIds.has((item as Route).id)}
            />
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

function RouteCard({
  item,
  origin,
  live,
  downloaded,
}: {
  item: RouteListItem;
  origin: { lat: number; lon: number } | null;
  live: boolean;
  downloaded: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = item.difficulty ? (DIFFICULTY_COLORS[item.difficulty] ?? NEUTRAL_ACCENT) : NEUTRAL_ACCENT;
  const awayM = origin ? nearestPointDistanceM(origin, item.geometry.coordinates) : null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
        {downloaded ? (
          <View style={styles.statusTag}>
            <Ionicons name="cloud-done" size={14} color={SUCCESS} />
            <ThemedText type="small" style={styles.offlineLabel}>
              {t('routes.offline')}
            </ThemedText>
          </View>
        ) : live ? (
          <View style={styles.statusTag}>
            <Ionicons name="cloud-outline" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('routes.online')}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {item.region ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {item.region}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.statRow}>
        {item.difficulty ? (
          <RouteStat dotColor={accent} value={t(`difficulty.${item.difficulty}`, item.difficulty)} />
        ) : null}
        <RouteStat icon="swap-horizontal" value={formatDistance(item.distanceM)} />
        <RouteStat icon="trending-up" value={formatElevation(item.ascentM)} />
        {awayM != null ? <RouteStat icon="navigate-outline" value={formatDistance(awayM)} /> : null}
      </View>
    </ThemedView>
  );
}

/** A compact icon/value (or colored-dot/value) pair used in a route card's stat row. */
function RouteStat({
  icon,
  dotColor,
  value,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  dotColor?: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      {dotColor ? (
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      ) : icon ? (
        <Ionicons name={icon} size={14} color={theme.textSecondary} />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {value}
      </ThemedText>
    </View>
  );
}

function RegionChip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
        },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: ACCENT,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.four,
  },
  planLabel: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  iconButton: { padding: Spacing.one },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16 },
  nearMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderLeftWidth: 1,
    paddingLeft: Spacing.two,
    marginLeft: Spacing.half,
  },
  nearMeLabel: { color: ACCENT, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  bannerText: { flexShrink: 1 },
  chipRow: { gap: Spacing.two, paddingRight: Spacing.four },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  sectionEmpty: { paddingVertical: Spacing.two },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderLeftWidth: 3,
    gap: Spacing.two,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  offlineLabel: { color: SUCCESS, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three },
  stat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center', paddingHorizontal: Spacing.four },
});

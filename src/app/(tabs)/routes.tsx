import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Colors, Spacing } from '@/constants/theme';
import {
  searchRoutesByName,
  searchRoutesNearby,
  type OverpassQueryError,
  type OverpassResult,
  type OverpassRouteResult,
} from '@/data/overpass';
import { saveOverpassRoute } from '@/data/routeService';
import { listRegions, queryRoutes } from '@/db/routes';
import type { Route } from '@/db/types';
import { importGpxFromPicker } from '@/gpx/import';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentCoordinates } from '@/safety/sos';
import { formatDistance, formatElevation, nearestPointDistanceM } from '@/tracking/stats';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#30A46C',
  moderate: '#F5A623',
  hard: '#E5484D',
  expert: '#8E4EC6',
};

/** Minimum query length before an online search fires (keeps Overpass load down). */
const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 500;

type RouteListItem = Route | OverpassRouteResult;
type RouteSection = { kind: 'saved' | 'osm'; title: string; data: RouteListItem[] };

function errorMessage(error: OverpassQueryError): string {
  switch (error.kind) {
    case 'network':
      return 'No connection — showing saved routes.';
    case 'rate-limit':
      return 'Search is busy, try again in a moment.';
    case 'server':
      return 'Search unavailable right now.';
  }
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      const { query: q, region: r } = filtersRef.current;
      reload(q, r);
      // Acquire the location fix only once so typing never re-prompts.
      if (!hasLocation.current) {
        hasLocation.current = true;
        getCurrentCoordinates().then((coords) => {
          if (coords) setOrigin({ lat: coords.lat, lon: coords.lon });
        });
      }
    }, [reload]),
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
      Alert.alert('Location needed', 'Enable location access to find routes near you.');
      return;
    }
    runSearch(() => searchRoutesNearby(coords!));
  }, [origin, runSearch]);

  const onImport = useCallback(async () => {
    try {
      const route = await importGpxFromPicker();
      if (route) {
        await reload(query, region);
        Alert.alert('Imported', `Added "${route.name}" to your routes.`);
      }
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : 'Could not read GPX file.');
    }
  }, [reload, query, region]);

  // Persist a live result before navigating — the detail screen reads by id from SQLite.
  const onOpenLive = useCallback(
    async (result: OverpassRouteResult) => {
      try {
        await saveOverpassRoute(result);
        await reload(query, region);
        router.push(`/route/${result.key}`);
      } catch (err) {
        Alert.alert('Could not open route', err instanceof Error ? err.message : 'Unknown error.');
      }
    },
    [reload, query, region],
  );

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
    setRefreshing(false);
  }, [liveActive, query, region, reload, runSearch]);

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

  const sections: RouteSection[] = [{ kind: 'saved', title: 'Saved', data: sortedSaved }];
  if (liveActive) {
    sections.push({ kind: 'osm', title: 'From OpenStreetMap', data: sortedLive });
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Routes</ThemedText>
        <View style={styles.headerActions}>
          <Pressable onPress={onNearby} style={styles.headerButton} accessibilityRole="button">
            <Ionicons name="navigate-outline" size={18} color="#208AEF" />
            <ThemedText type="linkPrimary">Near me</ThemedText>
          </Pressable>
          <Pressable onPress={onImport} style={styles.headerButton} accessibilityRole="button">
            <Ionicons name="download-outline" size={18} color="#208AEF" />
            <ThemedText type="linkPrimary">Import GPX</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: Colors.light.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onSearch}
          placeholder="Search trails online or saved"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      {regions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          <RegionChip
            label="All"
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
            {errorMessage(searchError)}
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
              No trails found online for that name.
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            No saved routes. Search online above or import a GPX file.
          </ThemedText>
        }
        renderItem={({ item, section }) => (
          <Pressable
            onPress={() =>
              section.kind === 'osm'
                ? onOpenLive(item as OverpassRouteResult)
                : router.push(`/route/${(item as Route).id}`)
            }>
            <RouteCard item={item} origin={origin} live={section.kind === 'osm'} />
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
}: {
  item: RouteListItem;
  origin: { lat: number; lon: number } | null;
  live: boolean;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
        {item.difficulty ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: DIFFICULTY_COLORS[item.difficulty] ?? '#6B7280' },
            ]}>
            <ThemedText style={styles.badgeText}>{item.difficulty}</ThemedText>
          </View>
        ) : null}
      </View>
      {item.region ? (
        <ThemedText type="small" themeColor="textSecondary">
          {item.region}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {formatDistance(item.distanceM)} · {formatElevation(item.ascentM)} ascent
      </ThemedText>
      {origin ? (
        <ThemedText type="small" themeColor="textSecondary">
          {formatDistance(nearestPointDistanceM(origin, item.geometry.coordinates))} away
        </ThemedText>
      ) : null}
      {live ? (
        <ThemedText type="small" themeColor="textSecondary">
          Tap to save for offline use
        </ThemedText>
      ) : null}
    </ThemedView>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16 },
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
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.one },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { syncRoutes } from '@/data/routeService';
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

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);

  // Mirror the current filters so the focus effect can sync without listing
  // them as dependencies (which would re-fire the network sync on each keystroke).
  // Updated from the event handlers below, never during render.
  const filtersRef = useRef({ query, region });
  const hasLocation = useRef(false);

  const reload = useCallback(async (keyword: string, regionFilter: string | null) => {
    const data = await queryRoutes({ keyword, region: regionFilter ?? undefined });
    setRoutes(data);
    setRegions(await listRegions());
  }, []);

  // Pulls the latest catalog from the network and reflects the result in the
  // cached list. Network/parse failures surface as the offline banner.
  const refresh = useCallback(
    async (keyword: string, regionFilter: string | null) => {
      setSyncing(true);
      const result = await syncRoutes();
      setOffline(!result.ok);
      await reload(keyword, regionFilter);
      setSyncing(false);
    },
    [reload],
  );

  useFocusEffect(
    useCallback(() => {
      const { query: q, region: r } = filtersRef.current;
      reload(q, r);
      refresh(q, r);
      // Acquire the location fix only once so typing never re-prompts.
      if (!hasLocation.current) {
        hasLocation.current = true;
        getCurrentCoordinates().then((coords) => {
          if (coords) setOrigin({ lat: coords.lat, lon: coords.lon });
        });
      }
    }, [reload, refresh]),
  );

  const onSearch = useCallback(
    (text: string) => {
      setQuery(text);
      filtersRef.current = { ...filtersRef.current, query: text };
      reload(text, region);
    },
    [reload, region],
  );

  const onSelectRegion = useCallback(
    (next: string | null) => {
      setRegion(next);
      filtersRef.current = { ...filtersRef.current, region: next };
      reload(query, next);
    },
    [reload, query],
  );

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

  // Sort by proximity when a location fix is available; otherwise keep the
  // alphabetical order returned by the query.
  const sorted = origin
    ? [...routes].sort(
        (a, b) =>
          nearestPointDistanceM(origin, a.geometry.coordinates) -
          nearestPointDistanceM(origin, b.geometry.coordinates),
      )
    : routes;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Routes</ThemedText>
        <Pressable onPress={onImport} style={styles.importButton} accessibilityRole="button">
          <Ionicons name="download-outline" size={18} color="#208AEF" />
          <ThemedText type="linkPrimary">Import GPX</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.searchBox, { backgroundColor: Colors.light.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onSearch}
          placeholder="Search trails or regions"
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

      {offline ? (
        <View style={[styles.banner, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
            No network — showing saved routes.
          </ThemedText>
        </View>
      ) : null}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six, gap: Spacing.two }}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={() => refresh(query, region)} />
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {offline
              ? 'No network connection. Connect and pull to refresh.'
              : 'No routes found. Import a GPX file to add your own.'}
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/route/${item.id}`)}>
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
            </ThemedView>
          </Pressable>
        )}
      />
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
  importButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
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
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.one },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});

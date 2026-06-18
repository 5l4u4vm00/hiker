import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { listRoutes, searchRoutes } from '@/db/routes';
import type { Route } from '@/db/types';
import { importGpxFromPicker } from '@/gpx/import';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatElevation } from '@/tracking/stats';

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
  const [query, setQuery] = useState('');

  const reload = useCallback(async (q: string) => {
    const data = q.trim() ? await searchRoutes(q.trim()) : await listRoutes();
    setRoutes(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload(query);
    }, [reload, query]),
  );

  const onSearch = useCallback(
    (text: string) => {
      setQuery(text);
      reload(text);
    },
    [reload],
  );

  const onImport = useCallback(async () => {
    try {
      const route = await importGpxFromPicker();
      if (route) {
        await reload(query);
        Alert.alert('Imported', `Added "${route.name}" to your routes.`);
      }
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : 'Could not read GPX file.');
    }
  }, [reload, query]);

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

      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six, gap: Spacing.two }}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            No routes found. Import a GPX file to add your own.
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
            </ThemedView>
          </Pressable>
        )}
      />
    </ThemedView>
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
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.one },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});

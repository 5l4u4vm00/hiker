import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  type DownloadedRegion,
  deleteRegion,
  formatBytes,
  listDownloadedRegions,
} from '@/map/offlineTiles';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [downloaded, setDownloaded] = useState<DownloadedRegion[]>([]);

  const reload = useCallback(async () => {
    try {
      setDownloaded(await listDownloadedRegions());
    } catch {
      setDownloaded([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onDelete = useCallback(
    async (region: DownloadedRegion) => {
      Alert.alert('Delete offline map?', `Remove "${region.name}" (${formatBytes(region.sizeBytes)})?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRegion(region.id);
            await reload();
          },
        },
      ]);
    },
    [reload],
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.four,
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + Spacing.six,
          gap: Spacing.four,
        }}>
        <ThemedText type="subtitle">Settings</ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Offline maps</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Open a route and tap “Download offline map” to save its area for offline use. Downloads
            appear here so you can manage storage.
          </ThemedText>
          {downloaded.length > 0 ? (
            downloaded.map((region) => (
              <ThemedView key={region.id} type="backgroundElement" style={styles.regionRow}>
                <View style={styles.flex}>
                  <ThemedText style={styles.regionName}>{region.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatBytes(region.sizeBytes)} · {Math.round(region.percentage)}%
                  </ThemedText>
                </View>
                <Pressable onPress={() => onDelete(region)} hitSlop={8}>
                  <Ionicons name="trash" size={24} color="#E5484D" />
                </Pressable>
              </ThemedView>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No offline maps downloaded yet.
            </ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Hiker stores all your data on this device. Maps © OpenStreetMap contributors.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  regionName: { fontSize: 16, fontWeight: '600' },
  flex: { flex: 1 },
});

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  type DownloadedRegion,
  deleteRegion,
  downloadRegion,
  formatBytes,
  listDownloadedRegions,
  OFFLINE_PRESETS,
} from '@/map/offlineTiles';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [downloaded, setDownloaded] = useState<DownloadedRegion[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

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

  const onDownload = useCallback(
    async (key: string) => {
      const preset = OFFLINE_PRESETS.find((p) => p.key === key);
      if (!preset) return;
      setActiveKey(key);
      setProgress(0);
      try {
        await downloadRegion(preset, (p) => setProgress(p.percentage));
        await reload();
      } catch (err) {
        Alert.alert('Download failed', err instanceof Error ? err.message : 'Unknown error.');
      } finally {
        setActiveKey(null);
      }
    },
    [reload],
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

  const downloadedKeys = new Set(downloaded.map((d) => d.key));

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
            Download map regions before you lose signal. Tiles are stored on your device.
          </ThemedText>
          {OFFLINE_PRESETS.map((preset) => {
            const isActive = activeKey === preset.key;
            const isDownloaded = downloadedKeys.has(preset.key);
            return (
              <ThemedView key={preset.key} type="backgroundElement" style={styles.regionRow}>
                <View style={styles.flex}>
                  <ThemedText style={styles.regionName}>{preset.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Zoom {preset.minZoom}–{preset.maxZoom}
                    {isActive ? ` · downloading ${Math.round(progress)}%` : ''}
                  </ThemedText>
                </View>
                {isActive ? (
                  <ActivityIndicator color="#208AEF" />
                ) : isDownloaded ? (
                  <Ionicons name="checkmark-circle" size={26} color="#30A46C" />
                ) : (
                  <Pressable onPress={() => onDownload(preset.key)} hitSlop={8}>
                    <Ionicons name="download-outline" size={26} color="#208AEF" />
                  </Pressable>
                )}
              </ThemedView>
            );
          })}
        </View>

        {downloaded.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Downloaded</ThemedText>
            {downloaded.map((region) => (
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
            ))}
          </View>
        ) : null}

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

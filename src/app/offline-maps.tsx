import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  deleteRegion,
  type DownloadedRegion,
  formatBytes,
  listDownloadedRegions,
  MAX_OFFLINE_REGIONS,
} from '@/map/offlineTiles';

const DESTRUCTIVE = '#E5484D';

/**
 * Lists every downloaded offline tile pack with its size and the running total,
 * and lets the user delete packs to reclaim device storage. Reached from
 * Settings; downloads themselves are still triggered per-route in the route
 * detail screen.
 */
export default function OfflineMapsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [regions, setRegions] = useState<DownloadedRegion[]>([]);

  const reload = useCallback(async () => {
    try {
      setRegions(await listDownloadedRegions());
    } catch {
      setRegions([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onDelete = useCallback(
    (region: DownloadedRegion) => {
      Alert.alert(
        t('offlineMaps.deleteTitle'),
        t('offlineMaps.deleteMessage', { name: region.name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              await deleteRegion(region.id);
              await reload();
            },
          },
        ],
      );
    },
    [reload, t],
  );

  const totalBytes = regions.reduce((sum, r) => sum + r.sizeBytes, 0);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.four,
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + Spacing.six,
          gap: Spacing.three,
        }}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('offlineMaps.summary', {
            count: regions.length,
            max: MAX_OFFLINE_REGIONS,
            size: formatBytes(totalBytes),
          })}
        </ThemedText>

        {regions.length === 0 ? (
          <ThemedText themeColor="textSecondary">{t('offlineMaps.empty')}</ThemedText>
        ) : (
          regions.map((region) => (
            <ThemedView key={region.id} type="backgroundElement" style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText style={styles.name} numberOfLines={1}>
                  {region.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatBytes(region.sizeBytes)}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => onDelete(region)}
                hitSlop={8}
                accessibilityRole="button">
                <Ionicons name="trash" size={22} color={DESTRUCTIVE} />
              </Pressable>
            </ThemedView>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.half },
  name: { fontWeight: '600' },
});

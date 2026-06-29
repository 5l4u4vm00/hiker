import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WAYPOINT_META } from '@/components/waypoint-sheet';
import { Spacing } from '@/constants/theme';
import type { WaypointType } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { useMapLayerStore, type BooleanLayer } from '@/state/mapLayerStore';

const POI_TYPES = Object.keys(WAYPOINT_META) as WaypointType[];

/** A labelled row with an optional leading icon and a trailing on/off Switch. */
function ToggleRow({
  label,
  value,
  onValueChange,
  icon,
  iconColor,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.iconBadge, { backgroundColor: iconColor ?? theme.backgroundElement }]}>
          <Ionicons name={icon} size={14} color="#ffffff" />
        </View>
      ) : null}
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#208AEF' }} />
    </View>
  );
}

/**
 * Bottom sheet listing the optional hiking layers, grouped into terrain, route
 * helpers, and POI categories. Reads and writes `useMapLayerStore`, which
 * persists each change. Opened from the layers button in `MapCanvas`.
 */
export function LayerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const hillshade = useMapLayerStore((s) => s.hillshade);
  const distanceMarkers = useMapLayerStore((s) => s.distanceMarkers);
  const nearbyRoutes = useMapLayerStore((s) => s.nearbyRoutes);
  const poiCategories = useMapLayerStore((s) => s.poiCategories);
  const setLayer = useMapLayerStore((s) => s.setLayer);
  const togglePoiCategory = useMapLayerStore((s) => s.togglePoiCategory);

  const booleanLayers: { key: BooleanLayer; label: string; value: boolean }[] = [
    { key: 'distanceMarkers', label: t('layers.distanceMarkers'), value: distanceMarkers },
    { key: 'nearbyRoutes', label: t('layers.nearbyRoutes'), value: nearbyRoutes },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView style={styles.sheet}>
        <ThemedText type="subtitle" style={styles.heading}>
          {t('layers.title')}
        </ThemedText>

        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('layers.terrain')}
        </ThemedText>
        <ToggleRow
          label={t('layers.hillshade')}
          value={hillshade}
          onValueChange={(v) => setLayer('hillshade', v)}
        />

        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('layers.routeHelpers')}
        </ThemedText>
        {booleanLayers.map((layer) => (
          <ToggleRow
            key={layer.key}
            label={layer.label}
            value={layer.value}
            onValueChange={(v) => setLayer(layer.key, v)}
          />
        ))}

        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('layers.pois')}
        </ThemedText>
        {POI_TYPES.map((type) => (
          <ToggleRow
            key={type}
            label={t(`waypointTypes.${type}`)}
            icon={WAYPOINT_META[type].icon}
            iconColor={WAYPOINT_META[type].color}
            value={poiCategories.includes(type)}
            onValueChange={() => togglePoiCategory(type)}
          />
        ))}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    gap: Spacing.two,
  },
  heading: { fontSize: 22, lineHeight: 28, marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1 },
});

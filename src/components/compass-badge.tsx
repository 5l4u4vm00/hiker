import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export interface CompassBadgeProps {
  /** Device heading in degrees clockwise from north (0 = north). */
  heading: number;
  /** When set, the badge becomes a button (e.g. to reset the map to north). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A compass that always points to true north: a two-tone arrow (red north tip,
 * gray south tail) rotates by `-heading` so it tracks north as the device turns,
 * with the current facing bearing shown upright below. When `onPress` is set the
 * badge is tappable (used to snap the map back to north-up).
 */
export function CompassBadge({ heading, onPress, style }: CompassBadgeProps) {
  const { t } = useTranslation();
  const bearing = Math.round(((heading % 360) + 360) % 360);
  const content = (
    <>
      <View style={styles.arrowBox}>
        <View style={[styles.dial, { transform: [{ rotate: `${-heading}deg` }] }]}>
          <ThemedText style={styles.northLabel}>{t('units.cardinals.N')}</ThemedText>
          <View style={styles.northTip} />
          <View style={styles.southTail} />
        </View>
      </View>
      <ThemedText style={styles.bearing}>{bearing}°</ThemedText>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('mapCanvas.resetNorth')}>
        <ThemedView type="backgroundElement" style={[styles.badge, style]}>
          {content}
        </ThemedView>
      </Pressable>
    );
  }
  return (
    <ThemedView type="backgroundElement" style={[styles.badge, style]}>
      {content}
    </ThemedView>
  );
}

const TIP_WIDTH = 5;
const TIP_HEIGHT = 13;
const TAIL_WIDTH = 5;
const TAIL_HEIGHT = 9;

const styles = StyleSheet.create({
  badge: {
    width: 48,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 5,
    gap: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  arrowBox: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dial: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  northLabel: {
    position: 'absolute',
    top: -1,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '700',
    color: '#E5484D',
  },
  // Red north arrowhead (taller, points up).
  northTip: {
    width: 0,
    height: 0,
    borderLeftWidth: TIP_WIDTH,
    borderRightWidth: TIP_WIDTH,
    borderBottomWidth: TIP_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E5484D',
  },
  // Gray south tail (shorter, points down), meeting the tip at center.
  southTail: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_WIDTH,
    borderRightWidth: TAIL_WIDTH,
    borderTopWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#9CA3AF',
  },
  bearing: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
  },
});

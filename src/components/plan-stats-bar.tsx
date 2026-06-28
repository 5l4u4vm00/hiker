import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { ElevationStatus } from '@/state/planStore';
import { formatDistance, formatDurationShort, formatElevation } from '@/tracking/stats';

export interface PlanStatsBarProps {
  topInset: number;
  pointCount: number;
  distanceM: number;
  /** Ascent (m) when elevations are ready; ignored otherwise. */
  ascentM: number;
  /** Naismith estimate (s); flat-only when ascent is unknown. */
  durationS: number;
  elevationStatus: ElevationStatus;
  /** Reports the bar's measured height so callers can offset overlapping controls below it. */
  onHeightChange?: (height: number) => void;
}

/** Live stats while drawing: distance, ascent, estimated time, and point count. */
export function PlanStatsBar({
  topInset,
  pointCount,
  distanceM,
  ascentM,
  durationS,
  elevationStatus,
  onHeightChange,
}: PlanStatsBarProps) {
  const { t } = useTranslation();

  const ascentValue =
    pointCount < 2
      ? '--'
      : elevationStatus === 'ready'
        ? formatElevation(ascentM)
        : elevationStatus === 'loading' || elevationStatus === 'idle'
          ? '…'
          : '--';

  const timeCaption = elevationStatus === 'ready' ? undefined : t('plan.flatEstimate');

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.bar, { top: topInset + Spacing.two }]}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
      <Stat label={t('plan.distance')} value={pointCount >= 2 ? formatDistance(distanceM) : '--'} />
      <Stat label={t('plan.ascent')} value={ascentValue} />
      <Stat
        label={t('plan.time')}
        value={pointCount >= 2 ? formatDurationShort(durationS) : '--'}
        caption={pointCount >= 2 ? timeCaption : undefined}
      />
      <Stat label={t('plan.points')} value={String(pointCount)} />
    </ThemedView>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.value}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {caption ? (
        <ThemedText style={styles.caption} themeColor="textSecondary">
          {caption}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stat: { alignItems: 'center', gap: 1 },
  value: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 10 },
});

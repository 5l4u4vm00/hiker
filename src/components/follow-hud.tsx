import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { FollowNav } from '@/map/use-follow-navigation';
import { formatDistance, formatDurationShort } from '@/tracking/stats';

const ROUTE_COLOR = '#E5484D';
const OFF_ROUTE_COLOR = '#FF9500';
const PROGRESS_COLOR = '#208AEF';

interface FollowHudProps {
  name: string;
  nav: FollowNav | null;
  topInset: number;
  onClose: () => void;
  /** Reports the panel's measured height so callers can offset map controls below it. */
  onHeightChange?: (height: number) => void;
}

/**
 * Top-anchored guidance panel for a followed route/track. Shows progress, the
 * remaining distance, ETA, and the next waypoint, plus an amber off-route
 * warning. Coexists with the bottom recording panel.
 */
export function FollowHud({ name, nav, topInset, onClose, onHeightChange }: FollowHudProps) {
  const { t } = useTranslation();
  const offRoute = nav?.offRoute ?? false;
  const accent = offRoute ? OFF_ROUTE_COLOR : ROUTE_COLOR;
  const progressPct = nav ? Math.round(nav.progress * 100) : 0;

  const handleLayout = (e: LayoutChangeEvent) => onHeightChange?.(e.nativeEvent.layout.height);

  return (
    <ThemedView
      type="backgroundElement"
      onLayout={handleLayout}
      style={[styles.container, { top: topInset }]}>
      <View style={styles.header}>
        <Ionicons name="trail-sign" size={18} color={accent} />
        <View style={styles.headerText}>
          <ThemedText type="small" themeColor="textSecondary">
            {nav ? t('followHud.followingProgress', { percent: progressPct }) : t('followHud.following')}
          </ThemedText>
          <ThemedText style={styles.name} numberOfLines={1}>
            {name}
          </ThemedText>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('followHud.stopFollowing')}>
          <Ionicons name="close-circle" size={24} color="#6B7280" />
        </Pressable>
      </View>

      {nav ? (
        <>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(2, progressPct)}%`, backgroundColor: offRoute ? OFF_ROUTE_COLOR : PROGRESS_COLOR },
              ]}
            />
          </View>

          {offRoute ? (
            <View style={styles.offRoute}>
              <Ionicons name="warning" size={16} color={OFF_ROUTE_COLOR} />
              <ThemedText type="smallBold" style={{ color: OFF_ROUTE_COLOR }}>
                {t('followHud.offRoute', { distance: formatDistance(nav.distanceToRouteM) })}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.metrics}>
            <Metric label={t('followHud.remaining')} value={formatDistance(nav.remainingM)} />
            <Metric
              label={t('followHud.eta')}
              value={nav.etaSeconds != null ? formatDurationShort(nav.etaSeconds) : '--'}
            />
            <Metric
              label={t('followHud.next')}
              value={nav.nextWaypoint ? formatDistance(nav.nextWaypoint.distanceM) : '--'}
              sub={nav.nextWaypoint?.name}
            />
          </View>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('followHud.locating')}
        </ThemedText>
      )}
    </ThemedView>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.metric}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
      {sub ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  offRoute: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  metrics: { flexDirection: 'row', gap: Spacing.three },
  metric: { flex: 1, gap: 1 },
});

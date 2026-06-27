import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface StatCardProps {
  label: string;
  value: string;
  /** Optional leading icon shown next to the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Overrides the value text color (e.g. a warning hue for low daylight). */
  tint?: string;
  /** Smaller font and padding for a dense secondary row. */
  compact?: boolean;
}

/** A compact label/value card used in stat grids. */
export function StatCard({ label, value, icon, tint, compact }: StatCardProps) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, compact && styles.cardCompact]}>
      <ThemedText
        style={[styles.value, compact && styles.valueCompact, tint ? { color: tint } : null]}>
        {value}
      </ThemedText>
      <View style={styles.labelRow}>
        {icon ? <Ionicons name={icon} size={13} color={theme.textSecondary} /> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

/** Lays out stat cards in a responsive wrapping row. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  cardCompact: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  valueCompact: {
    fontSize: 16,
    fontWeight: '700',
  },
});

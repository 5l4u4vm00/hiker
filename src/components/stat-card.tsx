import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export interface StatCardProps {
  label: string;
  value: string;
}

/** A compact label/value card used in stat grids. */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText style={styles.value}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
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
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
});

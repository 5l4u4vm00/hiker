import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type ThemePreference, useThemeStore } from '@/state/themeStore';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ThemeSegmentedControl() {
  const theme = useTheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <View style={[styles.segments, { backgroundColor: theme.backgroundElement }]}>
      {THEME_OPTIONS.map((option) => {
        const selected = option.value === preference;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setPreference(option.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.backgroundSelected },
            ]}>
            <ThemedText
              type="small"
              themeColor={selected ? 'text' : 'textSecondary'}
              style={styles.segmentLabel}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

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
          <ThemedText style={styles.sectionTitle}>Appearance</ThemedText>
          <ThemeSegmentedControl />
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
  segments: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: { fontWeight: '600' },
});

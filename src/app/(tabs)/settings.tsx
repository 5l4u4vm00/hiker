import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type LanguagePreference, useLanguageStore } from '@/state/languageStore';
import { useMapTokenStore } from '@/state/mapTokenStore';
import { type ThemePreference, useThemeStore } from '@/state/themeStore';

const THEME_OPTIONS: { value: ThemePreference; labelKey: 'themeSystem' | 'themeLight' | 'themeDark' }[] =
  [
    { value: 'system', labelKey: 'themeSystem' },
    { value: 'light', labelKey: 'themeLight' },
    { value: 'dark', labelKey: 'themeDark' },
  ];

const LANGUAGE_OPTIONS: {
  value: LanguagePreference;
  labelKey: 'langSystem' | 'langEnglish' | 'langChinese';
}[] = [
  { value: 'system', labelKey: 'langSystem' },
  { value: 'en', labelKey: 'langEnglish' },
  { value: 'zh-Hant', labelKey: 'langChinese' },
];

function ThemeSegmentedControl() {
  const { t } = useTranslation();
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
              {t(`settings.${option.labelKey}`)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function LanguageSegmentedControl() {
  const { t } = useTranslation();
  const theme = useTheme();
  const preference = useLanguageStore((s) => s.preference);
  const setPreference = useLanguageStore((s) => s.setPreference);

  return (
    <View style={[styles.segments, { backgroundColor: theme.backgroundElement }]}>
      {LANGUAGE_OPTIONS.map((option) => {
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
              {t(`settings.${option.labelKey}`)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function MapTokenField() {
  const { t } = useTranslation();
  const theme = useTheme();
  const token = useMapTokenStore((s) => s.token);
  const setToken = useMapTokenStore((s) => s.setToken);

  return (
    <View style={styles.tokenField}>
      <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder={t('settings.maptilerTokenPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('settings.maptilerTokenHelp')}
      </ThemedText>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.four,
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + Spacing.six,
          gap: Spacing.four,
        }}>
        <ThemedText type="subtitle">{t('settings.title')}</ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('settings.appearance')}</ThemedText>
          <ThemeSegmentedControl />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('settings.language')}</ThemedText>
          <LanguageSegmentedControl />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('settings.map')}</ThemedText>
          <MapTokenField />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('settings.about')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('settings.aboutText')}
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
  tokenField: { gap: Spacing.two },
  inputBox: {
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    height: 48,
    justifyContent: 'center',
  },
  input: { fontSize: 16 },
});

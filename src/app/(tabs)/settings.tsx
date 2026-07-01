import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { resetAllData } from '@/db/reset';
import { useTheme } from '@/hooks/use-theme';
import { type LanguagePreference, useLanguageStore } from '@/state/languageStore';
import { useRecordingStore } from '@/state/recordingStore';
import { type ThemePreference, useThemeStore } from '@/state/themeStore';

const DESTRUCTIVE = '#E5484D';

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

function OfflineMapsRow() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.navigate('/offline-maps')}
      style={({ pressed }) => [
        styles.navRow,
        { backgroundColor: theme.backgroundElement },
        pressed && { opacity: 0.6 },
      ]}>
      <ThemedText style={styles.navLabel}>{t('settings.offlineMapsManage')}</ThemedText>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

function ClearDataButton() {
  const { t } = useTranslation();

  const performClear = async () => {
    try {
      await resetAllData();
      Alert.alert(t('settings.clearDataDoneTitle'), t('settings.clearDataDoneMessage'));
    } catch (err) {
      console.warn('[settings] clear all data failed', err);
      Alert.alert(t('settings.clearDataErrorTitle'), t('settings.clearDataErrorMessage'));
    }
  };

  const onPress = () => {
    // Deleting the active track mid-recording would corrupt live recording state.
    if (useRecordingStore.getState().status !== 'idle') {
      Alert.alert(t('settings.clearDataRecordingTitle'), t('settings.clearDataRecordingMessage'));
      return;
    }
    Alert.alert(t('settings.clearDataConfirmTitle'), t('settings.clearDataConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.clearData'), style: 'destructive', onPress: performClear },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.6 }]}>
      <ThemedText style={[styles.clearLabel, { color: DESTRUCTIVE }]}>
        {t('settings.clearData')}
      </ThemedText>
    </Pressable>
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
          <ThemedText style={styles.sectionTitle}>{t('settings.offlineMaps')}</ThemedText>
          <OfflineMapsRow />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('settings.about')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('settings.aboutText')}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('settings.data')}</ThemedText>
          <ClearDataButton />
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
  },
  navLabel: { fontWeight: '600' },
  clearButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DESTRUCTIVE,
    alignItems: 'center',
  },
  clearLabel: { fontWeight: '600' },
});

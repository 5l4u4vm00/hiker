import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CHECKLIST_SECTIONS, PREP_CHECKLIST } from '@/safety/checklist';

/**
 * A static pre-hike preparation checklist with ephemeral toggle state. Surfaced
 * after a route is saved so the hiker can tick off gear and prep before setting
 * off. Nothing is persisted.
 */
export function PrepChecklist() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {CHECKLIST_SECTIONS.map((section) => (
        <View key={section} style={styles.section}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
            {t(`checklist.sections.${section}`)}
          </ThemedText>
          {PREP_CHECKLIST.filter((item) => item.section === section).map((item) => {
            const isChecked = checked.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                style={styles.row}>
                <Ionicons
                  name={isChecked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isChecked ? '#30A46C' : theme.textSecondary}
                />
                <ThemedText
                  style={[styles.label, isChecked && styles.labelChecked]}
                  themeColor={isChecked ? 'textSecondary' : 'text'}>
                  {t(`checklist.items.${item.labelKey}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  section: { gap: Spacing.one },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  label: { fontSize: 15, flexShrink: 1 },
  labelChecked: { textDecorationLine: 'line-through' },
});

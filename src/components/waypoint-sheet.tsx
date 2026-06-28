import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { WaypointType } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

/** Icon and color used to render each waypoint type on the map and in the picker. */
export const WAYPOINT_META: Record<
  WaypointType,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  water: { icon: 'water', color: '#208AEF' },
  campsite: { icon: 'bonfire', color: '#F5A623' },
  peak: { icon: 'triangle', color: '#8E4EC6' },
  junction: { icon: 'git-branch', color: '#E5484D' },
  hut: { icon: 'home', color: '#30A46C' },
  view: { icon: 'eye', color: '#0EA5E9' },
  other: { icon: 'location', color: '#6B7280' },
};

const TYPES = Object.keys(WAYPOINT_META) as WaypointType[];

export interface WaypointSheetProps {
  initialName?: string;
  initialType?: WaypointType;
  /** Whether this is editing an existing waypoint (shows a delete action). */
  editing?: boolean;
  onSubmit: (name: string, type: WaypointType) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Modal for naming and typing a waypoint when adding or editing one. The parent
 * mounts it only while open so its fields initialize fresh from the props each
 * time, with no synchronizing effect.
 */
export function WaypointSheet({
  initialName = '',
  initialType = 'other',
  editing = false,
  onSubmit,
  onDelete,
  onClose,
}: WaypointSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<WaypointType>(initialType);

  const submit = () => {
    const trimmed = name.trim() || t(`waypointTypes.${type}`);
    onSubmit(trimmed, type);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView style={styles.sheet}>
        <ThemedText type="subtitle" style={styles.heading}>
          {t(editing ? 'plan.editWaypoint' : 'plan.addWaypoint')}
        </ThemedText>

        <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('plan.waypointNamePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
            autoFocus
          />
        </View>

        <View style={styles.typeRow}>
          {TYPES.map((tp) => {
            const meta = WAYPOINT_META[tp];
            const selected = tp === type;
            return (
              <Pressable
                key={tp}
                onPress={() => setType(tp)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: selected ? meta.color : theme.backgroundElement,
                  },
                ]}>
                <Ionicons
                  name={meta.icon}
                  size={16}
                  color={selected ? '#ffffff' : theme.textSecondary}
                />
                <ThemedText
                  type="small"
                  style={{ color: selected ? '#ffffff' : theme.textSecondary }}>
                  {t(`waypointTypes.${tp}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton title={t('common.save')} onPress={submit} />
        {editing && onDelete ? (
          <PrimaryButton title={t('plan.deleteWaypoint')} variant="danger" onPress={onDelete} />
        ) : null}
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
          <ThemedText themeColor="textSecondary">{t('common.cancel')}</ThemedText>
        </Pressable>
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
    gap: Spacing.three,
  },
  heading: { fontSize: 22, lineHeight: 28 },
  inputBox: {
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    height: 48,
    justifyContent: 'center',
  },
  input: { fontSize: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});

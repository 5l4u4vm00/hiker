import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlanMode } from '@/state/planStore';

export interface PlanToolbarProps {
  bottomInset: number;
  mode: PlanMode;
  onModeChange: (mode: PlanMode) => void;
  canUndo: boolean;
  canClear: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onClear: () => void;
  onAddByCoordinate: () => void;
  onEditCoordinate: () => void;
  onDeletePoint: () => void;
}

const MODES = [
  { mode: 'draw', icon: 'pencil', labelKey: 'plan.modeDraw' },
  { mode: 'edit', icon: 'move', labelKey: 'plan.modeEdit' },
  { mode: 'waypoint', icon: 'location', labelKey: 'plan.modeWaypoint' },
] as const;

/** Floating mode switch + per-mode action controls for the Plan screen. */
export function PlanToolbar({
  bottomInset,
  mode,
  onModeChange,
  canUndo,
  canClear,
  hasSelection,
  onUndo,
  onClear,
  onAddByCoordinate,
  onEditCoordinate,
  onDeletePoint,
}: PlanToolbarProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={[styles.bar, { bottom: bottomInset }]}>
      <ModeSwitch value={mode} onChange={onModeChange} />

      <ThemedView type="backgroundElement" style={styles.actions}>
        <ToolButton
          icon="arrow-undo-outline"
          label={t('plan.undo')}
          disabled={!canUndo}
          color={theme.text}
          onPress={onUndo}
        />

        {mode === 'draw' ? (
          <>
            <ToolButton
              icon="add-outline"
              label={t('plan.addByCoordinate')}
              color={theme.text}
              onPress={onAddByCoordinate}
            />
            <ToolButton
              icon="close-circle-outline"
              label={t('plan.clear')}
              disabled={!canClear}
              color="#E5484D"
              onPress={onClear}
            />
          </>
        ) : null}

        {mode === 'edit' && hasSelection ? (
          <>
            <ToolButton
              icon="create-outline"
              label={t('plan.editCoordinate')}
              color={theme.text}
              onPress={onEditCoordinate}
            />
            <ToolButton
              icon="trash-outline"
              label={t('plan.deletePoint')}
              color="#E5484D"
              onPress={onDeletePoint}
            />
          </>
        ) : null}
      </ThemedView>
    </ThemedView>
  );
}

function ModeSwitch({ value, onChange }: { value: PlanMode; onChange: (mode: PlanMode) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <ThemedView type="background" style={styles.segment}>
      {MODES.map(({ mode, icon, labelKey }) => {
        const selected = value === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segmentItem, selected && { backgroundColor: '#208AEF' }]}>
            <Ionicons name={icon} size={18} color={selected ? '#ffffff' : theme.textSecondary} />
            <ThemedText
              type="small"
              style={{ color: selected ? '#ffffff' : theme.textSecondary }}>
              {t(labelKey)}
            </ThemedText>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

function ToolButton({
  icon,
  label,
  color,
  disabled = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={22} color={color} />
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one + 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.one,
  },
  button: { alignItems: 'center', gap: 2, minWidth: 56 },
});

import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface PlanToolbarProps {
  bottomInset: number;
  canUndo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onClear: () => void;
  onAddWaypoint: () => void;
  onDeletePoint: () => void;
}

/** Floating editing controls for the Plan screen. */
export function PlanToolbar({
  bottomInset,
  canUndo,
  hasSelection,
  onUndo,
  onClear,
  onAddWaypoint,
  onDeletePoint,
}: PlanToolbarProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={[styles.bar, { bottom: bottomInset }]}>
      {hasSelection ? (
        <ToolButton
          icon="trash-outline"
          label={t('plan.deletePoint')}
          color="#E5484D"
          onPress={onDeletePoint}
        />
      ) : (
        <>
          <ToolButton
            icon="arrow-undo-outline"
            label={t('plan.undo')}
            disabled={!canUndo}
            color={theme.text}
            onPress={onUndo}
          />
          <ToolButton
            icon="location-outline"
            label={t('plan.waypoint')}
            color={theme.text}
            onPress={onAddWaypoint}
          />
          <ToolButton
            icon="close-circle-outline"
            label={t('plan.clear')}
            disabled={!canUndo}
            color={theme.text}
            onPress={onClear}
          />
        </>
      )}
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
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  button: { alignItems: 'center', gap: 2, minWidth: 56 },
});

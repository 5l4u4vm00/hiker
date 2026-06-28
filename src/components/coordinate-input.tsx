import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CoordinateInputProps {
  title: string;
  initialLat?: number;
  initialLng?: number;
  onSubmit: (lat: number, lng: number) => void;
  onClose: () => void;
}

const toField = (n: number | undefined) => (n === undefined ? '' : String(n));

/**
 * Modal for entering or adjusting a point's latitude/longitude in decimal
 * degrees. Used to place a route vertex by coordinate, fine-tune a selected
 * vertex, and set a waypoint location precisely. The parent mounts it only
 * while open so the fields initialize fresh from the props each time.
 */
export function CoordinateInput({
  title,
  initialLat,
  initialLng,
  onSubmit,
  onClose,
}: CoordinateInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [lat, setLat] = useState(toField(initialLat));
  const [lng, setLng] = useState(toField(initialLng));
  const [error, setError] = useState(false);

  const submit = () => {
    const latN = Number(lat.trim());
    const lngN = Number(lng.trim());
    const valid =
      lat.trim() !== '' &&
      lng.trim() !== '' &&
      Number.isFinite(latN) &&
      Number.isFinite(lngN) &&
      latN >= -90 &&
      latN <= 90 &&
      lngN >= -180 &&
      lngN <= 180;
    if (!valid) {
      setError(true);
      return;
    }
    onSubmit(latN, lngN);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView style={styles.sheet}>
          <ThemedText type="subtitle" style={styles.heading}>
            {title}
          </ThemedText>

          <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('plan.latitude')}
            </ThemedText>
            <TextInput
              value={lat}
              onChangeText={(text) => {
                setLat(text);
                setError(false);
              }}
              keyboardType="numbers-and-punctuation"
              placeholder="25.03304"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              autoFocus
            />
          </View>

          <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('plan.longitude')}
            </ThemedText>
            <TextInput
              value={lng}
              onChangeText={(text) => {
                setLng(text);
                setError(false);
              }}
              keyboardType="numbers-and-punctuation"
              placeholder="121.56542"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          {error ? (
            <ThemedText type="small" style={{ color: '#E5484D' }}>
              {t('plan.coordinateInvalid')}
            </ThemedText>
          ) : null}

          <PrimaryButton title={t('common.save')} onPress={submit} />
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
            <ThemedText themeColor="textSecondary">{t('common.cancel')}</ThemedText>
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    gap: 2,
  },
  input: { fontSize: 16 },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});

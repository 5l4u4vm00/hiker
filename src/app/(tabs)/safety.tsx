import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { addContact, deleteContact, listContacts } from '@/db/contacts';
import type { EmergencyContact } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { SAFETY_TIP_KEYS, TAIWAN_EMERGENCY_NUMBERS } from '@/safety/emergencyInfo';
import {
  buildSosMessage,
  callNumber,
  getCurrentCoordinates,
  sendSosSms,
  shareLocation,
} from '@/safety/sos';

export default function SafetyScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listContacts().then(setContacts);
    }, []),
  );

  const handleSos = useCallback(async () => {
    setSending(true);
    try {
      const coords = await getCurrentCoordinates();
      if (!coords) {
        Alert.alert(
          t('safety.locationUnavailableTitle'),
          t('safety.locationUnavailableMessage'),
        );
        return;
      }
      const message = buildSosMessage(coords);
      const buttons = [
        { text: t('common.cancel'), style: 'cancel' as const },
        { text: t('safety.shareLocation'), onPress: () => shareLocation(message) },
        { text: t('safety.call119'), onPress: () => callNumber('119') },
      ];
      if (contacts.length > 0) {
        buttons.splice(1, 0, {
          text: t('safety.textContacts'),
          onPress: async () => {
            const ok = await sendSosSms(message, contacts);
            if (!ok) {
              Alert.alert(t('safety.smsUnavailableTitle'), t('safety.smsUnavailableMessage'));
            }
          },
        });
      }
      Alert.alert(t('safety.sosTitle'), message, buttons);
    } finally {
      setSending(false);
    }
  }, [contacts, t]);

  const handleAddContact = useCallback(async () => {
    if (!name.trim() || !phone.trim()) return;
    await addContact(name.trim(), phone.trim());
    setName('');
    setPhone('');
    setContacts(await listContacts());
  }, [name, phone]);

  const handleDeleteContact = useCallback(async (id: string) => {
    await deleteContact(id);
    setContacts(await listContacts());
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.four,
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + Spacing.six,
          gap: Spacing.four,
        }}>
        <ThemedText type="subtitle">{t('safety.title')}</ThemedText>

        <PrimaryButton
          title={t('safety.sendSos')}
          variant="danger"
          onPress={handleSos}
          loading={sending}
        />

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('safety.contacts')}</ThemedText>
          {contacts.map((c) => (
            <ThemedView key={c.id} type="backgroundElement" style={styles.contactRow}>
              <View style={styles.flex}>
                <ThemedText style={styles.contactName}>{c.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.phone}
                </ThemedText>
              </View>
              <Pressable onPress={() => callNumber(c.phone)} hitSlop={8}>
                <Ionicons name="call" size={20} color="#208AEF" />
              </Pressable>
              <Pressable onPress={() => handleDeleteContact(c.id)} hitSlop={8}>
                <Ionicons name="trash" size={20} color="#E5484D" />
              </Pressable>
            </ThemedView>
          ))}
          <View style={styles.addRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('safety.namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t('safety.phonePlaceholder')}
              keyboardType="phone-pad"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
            />
            <Pressable onPress={handleAddContact} style={styles.addButton} hitSlop={8}>
              <Ionicons name="add-circle" size={32} color="#208AEF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('safety.emergencyNumbers')}</ThemedText>
          {TAIWAN_EMERGENCY_NUMBERS.map((n) => (
            <Pressable key={n.number} onPress={() => callNumber(n.number)}>
              <ThemedView type="backgroundElement" style={styles.numberRow}>
                <View style={styles.flex}>
                  <ThemedText style={styles.contactName}>{t(n.labelKey)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(n.noteKey)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.number}>{n.number}</ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('safety.safetyTips')}</ThemedText>
          {SAFETY_TIP_KEYS.map((tipKey) => (
            <View key={tipKey} style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={18} color="#30A46C" />
              <ThemedText type="small" style={styles.flex}>
                {t(tipKey)}
              </ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  contactName: { fontSize: 16, fontWeight: '600' },
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    fontSize: 15,
  },
  addButton: { padding: Spacing.half },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  number: { fontSize: 18, fontWeight: '700', color: '#208AEF' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
});

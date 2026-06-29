import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  addJournalEntry,
  deleteJournalEntry,
  getJournalEntries,
  updateJournalEntry,
} from '@/db/journal';
import { getTrack, renameTrack } from '@/db/tracks';
import type { JournalEntry } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

/** An existing note being edited, paired with its original text for diffing. */
interface EditableNote {
  id: string;
  original: string;
  note: string;
}

export default function HikeEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const headerHeight = useHeaderHeight();

  const [loaded, setLoaded] = useState(false);
  const [originalName, setOriginalName] = useState('');
  const [name, setName] = useState('');
  const [originalEntries, setOriginalEntries] = useState<JournalEntry[]>([]);
  const [notes, setNotes] = useState<EditableNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const track = await getTrack(id);
      const entries = await getJournalEntries(id);
      setOriginalName(track?.name ?? '');
      setName(track?.name ?? '');
      setOriginalEntries(entries);
      setNotes(entries.map((e) => ({ id: e.id, original: e.note, note: e.note })));
      setLoaded(true);
    })();
  }, [id]);

  const removeNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const updateNote = (noteId: string, text: string) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, note: text } : n)));
  };

  const onSave = async () => {
    if (!id || saving) return;
    setSaving(true);
    try {
      const trimmedName = name.trim();
      if (trimmedName && trimmedName !== originalName) {
        await renameTrack(id, trimmedName);
      }

      const keptIds = new Set(notes.map((n) => n.id));
      for (const entry of originalEntries) {
        if (!keptIds.has(entry.id)) {
          await deleteJournalEntry(entry.id);
        }
      }

      for (const note of notes) {
        const trimmed = note.note.trim();
        if (trimmed !== note.original.trim()) {
          await updateJournalEntry(note.id, trimmed);
        }
      }

      const trimmedNew = newNote.trim();
      if (trimmedNew) {
        await addJournalEntry(id, trimmedNew);
      }

      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            {t('hikeEdit.name')}
          </ThemedText>
          <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('hikeEdit.namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            {t('hikeEdit.notesLabel')}
          </ThemedText>

          {notes.map((n) => (
            <View key={n.id} style={styles.noteRow}>
              <View
                style={[styles.inputBox, styles.noteInputBox, { backgroundColor: theme.backgroundElement }]}>
                <TextInput
                  value={n.note}
                  onChangeText={(text) => updateNote(n.id, text)}
                  placeholder={t('hikeEdit.addNotePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={[styles.input, styles.noteInput, { color: theme.text }]}
                />
              </View>
              <Pressable
                onPress={() => removeNote(n.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('hikeEdit.deleteNote')}
                style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color="#E5484D" />
              </Pressable>
            </View>
          ))}

          <View style={[styles.inputBox, styles.noteInputBox, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              value={newNote}
              onChangeText={setNewNote}
              placeholder={t('hikeEdit.addNotePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.input, styles.noteInput, { color: theme.text }]}
            />
          </View>

          <PrimaryButton title={t('hikeEdit.saveChanges')} onPress={onSave} loading={saving} />
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.cancel}>
            <ThemedText themeColor="textSecondary">{t('common.cancel')}</ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.two },
  label: { marginTop: Spacing.two, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  inputBox: {
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    minHeight: 48,
    justifyContent: 'center',
  },
  input: { fontSize: 16 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  noteInputBox: { flex: 1, paddingVertical: Spacing.two },
  noteInput: { minHeight: 48, textAlignVertical: 'top' },
  deleteButton: { padding: Spacing.three, justifyContent: 'center', minHeight: 48 },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});

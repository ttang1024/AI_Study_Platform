import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { RichTextEditor } from '@/components/RichTextEditor';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { noteService } from '@/services/noteService';
import type { Note } from '@/types';
import { noteEditorStore } from '@/utils/noteEditorStore';

export default function NoteEditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [note, setNote] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef('');
  const onSavedRef = useRef<((updated: Note) => void) | null>(null);

  useEffect(() => {
    const session = noteEditorStore.take();
    if (!session) {
      // Opened without a hand-off (e.g. deep link) — nothing to edit.
      router.back();
      return;
    }
    setNote(session.note);
    draftRef.current = session.note.content;
    onSavedRef.current = session.onSaved;
    navigation.setOptions({ title: session.note.documentName ?? session.note.videoName ?? 'Edit note' });
  }, [router, navigation]);

  const save = async () => {
    if (!note || saving) return;
    setSaving(true);
    try {
      const updated = await noteService.update(note.id, { content: draftRef.current });
      onSavedRef.current?.(updated);
      router.back();
    } catch {
      Alert.alert('Couldn’t save', 'The note wasn’t saved — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!note) {
    return <ActivityIndicator style={styles.loading} color={Colors.primary} />;
  }

  return (
    <View style={styles.root}>
      <RichTextEditor
        initialHtml={note.content}
        onChangeHtml={(html) => { draftRef.current = html; }}
      />
      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={Colors.primaryForeground} />
            : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three, gap: Spacing.two },
  loading: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  cancelButton: {
    paddingVertical: 12, paddingHorizontal: Spacing.four,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 999, backgroundColor: Colors.bgCard,
  },
  cancelText: { ...Typography.bodyBold, color: Colors.textSecondary },
  saveButton: {
    paddingVertical: 12, paddingHorizontal: Spacing.five,
    borderRadius: 999, backgroundColor: Colors.primary, minWidth: 90, alignItems: 'center',
  },
  saveText: { ...Typography.bodyBold, color: Colors.primaryForeground },
});

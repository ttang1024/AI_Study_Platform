import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';

interface QuickNoteFormProps {
  onSubmit: (content: string) => Promise<void>;
}

export const QuickNoteForm: React.FC<QuickNoteFormProps> = ({ onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
  }, []);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onSubmit(content.trim());
      setContent('');
      setOpen(false);
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return saved ? (
      <EmptyState icon={Check} title="Note added" subtitle="Find it anytime on the Notes tab under Study." bordered />
    ) : (
      <EmptyState
        icon={NotebookPen}
        title="No Notes Yet"
        subtitle="Jot down a quick thought while it's fresh."
        action={{ label: 'Add Note', onPress: () => setOpen(true) }}
        bordered
      />
    );
  }

  return (
    <View style={styles.form}>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Write a note…"
        placeholderTextColor={Colors.textSecondary}
        multiline
        style={styles.input}
        autoFocus
      />
      <View style={styles.actions}>
        <Pressable onPress={() => setOpen(false)} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} loading={saving} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.three, backgroundColor: Colors.bgCard,
  },
  input: { ...Typography.body, color: Colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  actions: { ...Layout.row, justifyContent: 'flex-end', gap: Spacing.three },
  cancelText: { ...Typography.captionBold, color: Colors.textSecondary },
});

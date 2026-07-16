import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import type { Note } from '@/types';
import { stripHtml } from '@/utils/stripHtml';

interface NoteRowProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

// The list preview stays plain text; editing opens the full-screen rich-text
// editor (study/note-editor), which round-trips the note's HTML unchanged.
export const NoteRow: React.FC<NoteRowProps> = ({ note, onEdit, onDelete }) => (
  <Card style={styles.card}>
    <Text style={styles.source} numberOfLines={1}>{note.documentName ?? note.videoName ?? 'Note'}</Text>
    <Text style={styles.content} numberOfLines={6}>{stripHtml(note.content)}</Text>
    <View style={styles.actions}>
      <Pressable style={styles.actionButton} onPress={() => onEdit(note)}>
        <Pencil size={14} color={Colors.textSecondary} />
        <Text style={styles.actionText}>Edit</Text>
      </Pressable>
      <Pressable style={styles.actionButton} onPress={() => onDelete(note.id)}>
        <Trash2 size={14} color={Colors.red} />
        <Text style={[styles.actionText, { color: Colors.red }]}>Delete</Text>
      </Pressable>
    </View>
  </Card>
);

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  source: { ...Typography.captionBold, color: Colors.primary },
  content: { ...Typography.body, color: Colors.textPrimary },
  actions: { flexDirection: 'row', gap: Spacing.four },
  actionButton: { ...Layout.row, gap: 4 },
  actionText: { ...Typography.captionBold, color: Colors.textSecondary },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Highlighter from 'lucide-react-native/icons/highlighter';
import Trash2 from 'lucide-react-native/icons/trash-2';

import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { DocumentAnnotation } from '@/services/annotationsService';

interface Props {
  annotations: DocumentAnnotation[];
  onSelect: (annotation: DocumentAnnotation) => void;
  onDelete: (annotation: DocumentAnnotation) => void;
}

/** Highlight list under the viewer — mobile's counterpart to web's annotation sidebar. */
export function PdfAnnotationList({ annotations, onSelect, onDelete }: Props) {
  if (annotations.length === 0) return null;
  return (
    <View style={styles.listSection}>
      <View style={styles.listHeader}>
        <Highlighter size={14} color={Colors.primary} />
        <Text style={styles.listTitle}>Highlights ({annotations.length})</Text>
      </View>
      {annotations.map((a) => (
        <View key={a.documentAnnotationId} style={styles.annotationRow}>
          <View style={[styles.annotationDot, { backgroundColor: a.color }]} />
          <Pressable style={styles.annotationBody} onPress={() => onSelect(a)}>
            <Text style={styles.annotationText} numberOfLines={3}>{a.highlightedText}</Text>
            {!!a.note && <Text style={styles.annotationNote} numberOfLines={2}>{a.note}</Text>}
            <Text style={styles.annotationMeta}>Page {a.pageNumber}</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(a)} hitSlop={8}>
            <Trash2 size={15} color={Colors.red} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listSection: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two,
  },
  listHeader: { ...Layout.row, gap: 6 },
  listTitle: { ...Typography.captionBold, color: Colors.primary },
  annotationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  annotationDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  annotationBody: { flex: 1, gap: 2 },
  annotationText: { ...Typography.caption, color: Colors.textPrimary },
  annotationNote: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  annotationMeta: { fontSize: 10, color: Colors.textSecondary },
});

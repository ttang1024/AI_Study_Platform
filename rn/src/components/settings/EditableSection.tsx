import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Pencil from 'lucide-react-native/icons/pencil';
import X from 'lucide-react-native/icons/x';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

export interface SectionMessage {
  kind: 'success' | 'error';
  text: string;
}

interface EditableSectionProps {
  title: string;
  /** Collapsed view: a single label/value summary row. */
  summaryLabel: string;
  summaryValue: string;
  editing: boolean;
  onToggleEditing: () => void;
  message: SectionMessage | null;
  /** The edit form, shown in place of the summary row while editing. */
  children: React.ReactNode;
}

// Shared scaffold for the Settings edit-in-place sections (Profile, Password):
// uppercase section title, Edit/Cancel trigger, summary row when collapsed,
// and the success/error message line. Form state stays in the parents.
export const EditableSection: React.FC<EditableSectionProps> = ({
  title, summaryLabel, summaryValue, editing, onToggleEditing, message, children,
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable style={styles.editTrigger} onPress={onToggleEditing}>
        {editing ? <X size={14} color={Colors.textSecondary} /> : <Pencil size={14} color={Colors.primary} />}
        <Text style={[styles.editTriggerText, editing && styles.editTriggerTextCancel]}>
          {editing ? 'Cancel' : 'Edit'}
        </Text>
      </Pressable>
    </View>

    {editing ? children : (
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{summaryLabel}</Text>
        <Text style={styles.summaryValue}>{summaryValue}</Text>
      </View>
    )}

    {message && (
      <Text style={[styles.message, { color: message.kind === 'success' ? Colors.emerald : Colors.red }]}>
        {message.text}
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  sectionHeaderRow: { ...Layout.rowBetween },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  message: { fontSize: 12, fontWeight: '600' },

  editTrigger: { ...Layout.row, gap: 4, paddingHorizontal: 4, paddingVertical: 2 },
  editTriggerText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  editTriggerTextCancel: { color: Colors.textSecondary },

  summaryRow: {
    ...Layout.rowBetween, backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, height: 48,
  },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
});

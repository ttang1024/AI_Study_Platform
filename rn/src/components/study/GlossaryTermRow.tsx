import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Colors, Spacing, Typography } from '@/constants/theme';
import type { GlossaryTerm } from '@/types';

interface GlossaryTermRowProps {
  term: GlossaryTerm;
  mastered: boolean;
  onToggleMastered: (termId: string) => void;
  onSave: (termId: string, term: string, definition: string) => Promise<void>;
  onDelete: (termId: string) => void;
}

// Edit state lives per-row (not in the screen) so typing in one term's edit
// fields doesn't re-render every other visible row in the list.
export const GlossaryTermRow: React.FC<GlossaryTermRowProps> = ({ term, mastered, onToggleMastered, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draftTerm, setDraftTerm] = useState('');
  const [draftDefinition, setDraftDefinition] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraftTerm(term.term);
    setDraftDefinition(term.definition);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(term.id, draftTerm, draftDefinition);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <View style={styles.row}>
        <Pressable onPress={() => onToggleMastered(term.id)} hitSlop={8}>
          {mastered ? <CheckCircle2 size={20} color={Colors.emerald} /> : <Circle size={20} color={Colors.textSecondary} />}
        </Pressable>
        <View style={styles.body}>
          {editing ? (
            <>
              <TextInput value={draftTerm} onChangeText={setDraftTerm} style={styles.termInput} autoFocus />
              <TextInput value={draftDefinition} onChangeText={setDraftDefinition} style={styles.definitionInput} multiline />
              <View style={styles.editActions}>
                <Pressable onPress={() => setEditing(false)} disabled={saving}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={save} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.term}>{term.term}</Text>
              <Text style={styles.definition}>{term.definition}</Text>
              {!!term.sourceName && <Text style={styles.sourceName}>{term.sourceName}</Text>}
            </>
          )}
        </View>
        {!editing && (
          <View style={styles.actions}>
            <Pressable onPress={startEdit} hitSlop={8}>
              <Pencil size={16} color={Colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => onDelete(term.id)} hitSlop={8}>
              <Trash2 size={16} color={Colors.red} />
            </Pressable>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  body: { flex: 1, gap: 4 },
  term: { ...Typography.bodyBold, color: Colors.textPrimary },
  definition: { ...Typography.caption, color: Colors.textSecondary },
  sourceName: { ...Typography.caption, color: Colors.primary },
  actions: { flexDirection: 'row', gap: Spacing.two },
  termInput: { ...Typography.bodyBold, color: Colors.textPrimary, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 2 },
  definitionInput: { ...Typography.caption, color: Colors.textPrimary, minHeight: 50, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.three, marginTop: 4 },
  cancelText: { ...Typography.captionBold, color: Colors.textSecondary },
  saveText: { ...Typography.captionBold, color: Colors.primary },
});

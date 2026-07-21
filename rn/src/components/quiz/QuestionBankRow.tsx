import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, Pencil, Square, Trash2, CheckSquare } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { quizOptionTextStyles } from '@/components/quiz/quizOptionTextStyles';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import type { QuizQuestion } from '@/types';

interface QuestionDraft {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuestionBankRowProps {
  item: QuizQuestion;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSave: (item: QuizQuestion, draft: QuestionDraft) => Promise<void>;
  onDelete: (id: string) => void;
}

// Memoized, with edit-draft state kept local — so typing in one row's edit
// fields, or expanding a row, doesn't re-render every other visible row
// (this list is paginated and can grow large).
export const QuestionBankRow: React.FC<QuestionBankRowProps> = React.memo(function QuestionBankRow({
  item,
  expanded,
  selected,
  onToggleExpand,
  onToggleSelect,
  onSave,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);

  const startEdit = () => {
    setDraft({ question: item.question, options: [...(item.options ?? [])], correctAnswer: item.correctAnswer, explanation: item.explanation });
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    await onSave(item, draft);
    setEditing(false);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Pressable onPress={() => onToggleSelect(item.id)} hitSlop={8}>
          {selected ? <CheckSquare size={20} color={Colors.primary} /> : <Square size={20} color={Colors.textSecondary} />}
        </Pressable>
        <Pressable style={styles.body} onPress={() => onToggleExpand(item.id)}>
          <Text style={styles.question} numberOfLines={expanded ? undefined : 2}>{item.question}</Text>
          <Text style={styles.meta}>{item.difficulty} · {item.sourceName ?? item.sourceType}</Text>
        </Pressable>
        <Pressable onPress={() => onToggleExpand(item.id)} hitSlop={8}>
          {expanded ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
        </Pressable>
      </View>

      {expanded && !editing && (
        <View style={styles.detail}>
          {(item.options ?? []).map((opt) => (
            <Text key={opt} style={[quizOptionTextStyles.option, opt === item.correctAnswer && quizOptionTextStyles.optionCorrect]}>{opt}</Text>
          ))}
          <Text style={styles.explanation}>{item.explanation}</Text>
          <View style={styles.detailActions}>
            <Pressable style={styles.actionButton} onPress={startEdit}>
              <Pencil size={14} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => onDelete(item.id)}>
              <Trash2 size={14} color={Colors.red} />
              <Text style={[styles.actionText, { color: Colors.red }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}

      {expanded && editing && draft && (
        <View style={styles.detail}>
          <TextInput style={styles.input} value={draft.question} onChangeText={(t) => setDraft({ ...draft, question: t })} multiline />
          {draft.options.map((opt, i) => (
            <TextInput
              key={i}
              style={styles.input}
              value={opt}
              onChangeText={(t) => setDraft({ ...draft, options: draft.options.map((o, j) => (j === i ? t : o)) })}
            />
          ))}
          <TextInput style={styles.input} value={draft.correctAnswer} onChangeText={(t) => setDraft({ ...draft, correctAnswer: t })} placeholder="Correct answer" />
          <TextInput style={styles.input} value={draft.explanation} onChangeText={(t) => setDraft({ ...draft, explanation: t })} placeholder="Explanation" multiline />
          <View style={styles.detailActions}>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save}>
              <Text style={[styles.actionText, { color: Colors.primary }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { ...Layout.row, gap: Spacing.two },
  body: { flex: 1 },
  question: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  detail: { gap: 6 },
  explanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  detailActions: { flexDirection: 'row', gap: Spacing.four, marginTop: 4 },
  actionButton: { ...Layout.row, gap: 4 },
  actionText: { ...Typography.captionBold, color: Colors.textSecondary },
  input: {
    ...Typography.body, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: 8,
  },
});

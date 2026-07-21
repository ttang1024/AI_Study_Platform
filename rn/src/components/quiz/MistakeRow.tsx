import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Sparkles, Trash2, CheckCircle2 } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { quizOptionTextStyles } from '@/components/quiz/quizOptionTextStyles';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import type { Mistake, VariantQuestion } from '@/types';

interface MistakeRowProps {
  mistake: Mistake;
  expanded: boolean;
  variants: VariantQuestion[] | undefined;
  variantsLoading: boolean;
  onToggleExpand: (id: string) => void;
  onToggleStatus: (mistake: Mistake) => void;
  onLoadVariants: (id: string) => void;
  onRemove: (id: string) => void;
}

// Memoized so expanding one mistake doesn't re-render every other row in the list.
export const MistakeRow: React.FC<MistakeRowProps> = React.memo(function MistakeRow({
  mistake,
  expanded,
  variants,
  variantsLoading,
  onToggleExpand,
  onToggleStatus,
  onLoadVariants,
  onRemove,
}) {
  return (
    <Card style={styles.card}>
      <Pressable style={styles.row} onPress={() => onToggleExpand(mistake.id)}>
        <Text style={styles.question} numberOfLines={expanded ? undefined : 2}>{mistake.question}</Text>
        {expanded ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          {mistake.options.map((opt) => {
            const isCorrect = opt === mistake.correctAnswer;
            const isUserPick = opt === mistake.userAnswer;
            return (
              <Text
                key={opt}
                style={[
                  quizOptionTextStyles.option,
                  isCorrect && quizOptionTextStyles.optionCorrect,
                  isUserPick && !isCorrect && quizOptionTextStyles.optionWrong,
                ]}
              >
                {opt}
              </Text>
            );
          })}
          <Text style={styles.explanation}>{mistake.explanation}</Text>
          <Text style={styles.missedCount}>Missed {mistake.timesMissed} time{mistake.timesMissed === 1 ? '' : 's'}</Text>

          {variants?.map((v, i) => (
            <View key={i} style={styles.variantCard}>
              <Text style={styles.variantQuestion}>{v.question}</Text>
            </View>
          ))}

          <View style={styles.detailActions}>
            <Pressable style={styles.actionButton} onPress={() => onToggleStatus(mistake)}>
              <CheckCircle2 size={14} color={Colors.emerald} />
              <Text style={styles.actionText}>{mistake.status === 'open' ? 'Mark resolved' : 'Reopen'}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => onLoadVariants(mistake.id)} disabled={variantsLoading}>
              <Sparkles size={14} color={Colors.primary} />
              <Text style={styles.actionText}>{variantsLoading ? 'Generating…' : 'Practice variants'}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => onRemove(mistake.id)}>
              <Trash2 size={14} color={Colors.red} />
              <Text style={[styles.actionText, { color: Colors.red }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  question: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  detail: { gap: 6 },
  explanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  missedCount: { ...Typography.caption, color: Colors.amber },
  variantCard: { backgroundColor: Colors.bgApp, borderRadius: 8, padding: 8, marginTop: 4 },
  variantQuestion: { ...Typography.caption, color: Colors.textPrimary },
  detailActions: { flexDirection: 'row', gap: Spacing.three, marginTop: 4, flexWrap: 'wrap' },
  actionButton: { ...Layout.row, gap: 4 },
  actionText: { ...Typography.captionBold, color: Colors.textSecondary },
});

import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AnswerableQuestionRow } from '@/components/quiz/AnswerableQuestionRow';
import { questionBankService } from '@/services/questionBankService';
import { Alpha, Colors, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  ARTIFACT_META,
  buildArtifactRows,
  METRIC_CHIP_HEIGHT,
  type ArtifactKind,
  type CourseArtifacts,
} from '@/components/library/courseWorkspace';

interface Props {
  artifacts: CourseArtifacts | null;
  active: ArtifactKind;
  onChangeActive: (kind: ArtifactKind) => void;
}

export function CourseArtifactsPane({ artifacts, active, onChangeActive }: Props) {
  // Question answering state lives here (not in the rows) so it survives
  // FlatList virtualization unmounting offscreen rows.
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  const toggleQuestion = useCallback((id: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const answerQuestion = useCallback((id: string, option: string | null) => {
    setQuestionAnswers((prev) => {
      const next = { ...prev };
      if (option === null) delete next[id];
      else next[id] = option;
      return next;
    });
    // Feed the mistake notebook: wrong picks create/bump an entry, correct ones
    // resolve it. Grading stays local, so a network failure only loses tracking.
    if (option !== null) questionBankService.recordAttempt(id, option).catch(() => {});
  }, []);

  if (!artifacts) return <LoadingScreen />;

  const counts: Record<ArtifactKind, number> = {
    notes: artifacts.notes.length,
    flashcards: artifacts.flashcards.length,
    questions: artifacts.questions.length,
    glossary: artifacts.glossary.length,
  };

  const rows = buildArtifactRows(artifacts, active);

  return (
    <View style={styles.artifactsRoot}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricScroll} contentContainerStyle={styles.metricRow}>
        {ARTIFACT_META.map(({ kind, label, icon: Icon, color }) => {
          const isActive = active === kind;
          return (
            <Pressable
              key={kind}
              style={[styles.metricChip, isActive && { borderColor: color, backgroundColor: `${color}${Alpha.tint}` }]}
              onPress={() => onChangeActive(kind)}
            >
              <Icon size={14} color={isActive ? color : Colors.textSecondary} />
              <Text style={[styles.metricLabel, isActive && { color }]}>{label}</Text>
              <Text style={[styles.metricCount, isActive && { color }]}>{counts[kind]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {active === 'questions' ? (
        artifacts.questions.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nothing here yet" subtitle="Generate study artifacts from this course's materials." />
        ) : (
          <FlatList
            data={artifacts.questions}
            keyExtractor={(q) => q.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <AnswerableQuestionRow
                question={item}
                expanded={expandedQuestionIds.has(item.id)}
                answer={questionAnswers[item.id]}
                onToggleExpand={toggleQuestion}
                onAnswer={answerQuestion}
              />
            )}
          />
        )
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nothing here yet" subtitle="Generate study artifacts from this course's materials." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.artifactCard}>
              <Text style={styles.artifactTitle} numberOfLines={2}>{item.title}</Text>
              {!!item.body && <Text style={styles.artifactBody} numberOfLines={4}>{item.body}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  artifactsRoot: { flex: 1 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  metricScroll: { flexGrow: 0, flexShrink: 0, height: METRIC_CHIP_HEIGHT + Spacing.three + Spacing.two },
  metricRow: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, paddingBottom: Spacing.two },
  metricChip: {
    ...Layout.row, gap: 6, height: METRIC_CHIP_HEIGHT,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill,
    paddingHorizontal: 12, backgroundColor: Colors.bgCard,
  },
  metricLabel: { ...Typography.captionBold, lineHeight: 16, color: Colors.textSecondary },
  metricCount: { ...Typography.captionBold, lineHeight: 16, color: Colors.textSecondary },
  artifactCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three,
    gap: 4, ...Shadows.card,
  },
  artifactTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  artifactBody: { ...Typography.caption, color: Colors.textSecondary },
});

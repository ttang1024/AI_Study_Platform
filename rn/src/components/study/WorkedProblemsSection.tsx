import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { WorkedProblem, WorkedProblemAttempt } from '@/services/workedProblemsService';

type Difficulty = 'easy' | 'medium' | 'hard';
const COUNT_OPTIONS = [3, 5, 10];

interface WorkedProblemsSectionProps {
  getProblems: () => Promise<WorkedProblem[]>;
  generateProblems: (difficulty: Difficulty, count: number) => Promise<WorkedProblem[]>;
  submitAttempt: (problemId: string, userAnswer: string) => Promise<WorkedProblemAttempt>;
}

export const WorkedProblemsSection: React.FC<WorkedProblemsSectionProps> = ({ getProblems, generateProblems, submitAttempt }) => {
  const [problems, setProblems] = useState<WorkedProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getProblems().then(setProblems).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      setProblems(await generateProblems(difficulty, count));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <SegmentedTabs
        value={difficulty}
        onChange={setDifficulty}
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
        ]}
      />
      <View style={styles.countRow}>
        {COUNT_OPTIONS.map((n) => (
          <Pressable key={n} style={[styles.countChip, count === n && styles.countChipActive]} onPress={() => setCount(n)}>
            <Text style={[styles.countChipText, count === n && styles.countChipTextActive]}>{n} problems</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.three }} />
      ) : problems.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No Practice Problems Yet"
          subtitle="Generate step-by-step problems to test what you've learned."
          action={{ label: generating ? 'Generating…' : 'Generate Problems', onPress: generate, loading: generating }}
          bordered
        />
      ) : (
        <>
          <Button title={generating ? 'Generating…' : 'Regenerate'} onPress={generate} disabled={generating} loading={generating} />
          {problems.map((problem) => (
            <ProblemCard
              key={problem.workedProblemId}
              problem={problem}
              expanded={expandedId === problem.workedProblemId}
              onToggle={() => setExpandedId(expandedId === problem.workedProblemId ? null : problem.workedProblemId)}
              submitAttempt={submitAttempt}
            />
          ))}
        </>
      )}
    </View>
  );
};

const ProblemCard: React.FC<{
  problem: WorkedProblem;
  expanded: boolean;
  onToggle: () => void;
  submitAttempt: (problemId: string, userAnswer: string) => Promise<WorkedProblemAttempt>;
}> = ({ problem, expanded, onToggle, submitAttempt }) => {
  const [revealedSteps, setRevealedSteps] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<WorkedProblemAttempt | null>(null);

  const check = async () => {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      setAttempt(await submitAttempt(problem.workedProblemId, draft.trim()));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={styles.problemCard}>
      <Pressable style={styles.problemHeader} onPress={onToggle}>
        <View style={styles.problemHeaderText}>
          {!!problem.topic && <Text style={styles.topicBadge}>{problem.topic}</Text>}
          <Text style={styles.problemText} numberOfLines={expanded ? undefined : 2}>{problem.problemText}</Text>
        </View>
        {expanded ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
      </Pressable>

      {expanded && (
        <View style={styles.problemDetail}>
          {problem.steps.slice(0, revealedSteps).map((step) => (
            <View key={step.stepNumber} style={styles.stepRow}>
              <Text style={styles.stepText}>{step.stepNumber}. {step.description}</Text>
              {!!step.formula && <Text style={styles.stepFormula}>{step.formula}</Text>}
            </View>
          ))}
          {revealedSteps < problem.steps.length && (
            <Pressable style={styles.revealButton} onPress={() => setRevealedSteps((n) => n + 1)}>
              <Text style={styles.revealButtonText}>Show Step {revealedSteps + 1}</Text>
            </Pressable>
          )}

          <Pressable style={styles.revealButton} onPress={() => setShowAnswer((s) => !s)}>
            <Text style={styles.revealButtonText}>{showAnswer ? 'Hide Final Answer' : 'Show Final Answer'}</Text>
          </Pressable>
          {showAnswer && (
            <View style={styles.answerBox}>
              <SummaryMarkdown value={problem.finalAnswer} />
            </View>
          )}

          <Text style={styles.selfCheckLabel}>Try it yourself</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Your answer…"
            placeholderTextColor={Colors.textSecondary}
            style={styles.answerInput}
            multiline
            editable={!attempt}
          />
          {!attempt ? (
            <Button title={submitting ? 'Checking…' : 'Check Answer'} onPress={check} disabled={submitting || !draft.trim()} loading={submitting} />
          ) : attempt.aiEvaluation ? (
            <View
              style={[
                styles.feedbackBox,
                attempt.isCorrect === true && styles.feedbackCorrect,
                attempt.isCorrect === false && styles.feedbackWrong,
              ]}
            >
              <Text style={styles.feedbackText}>{attempt.aiEvaluation}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  countRow: { flexDirection: 'row', gap: Spacing.two },
  countChip: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  countChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  countChipText: { ...Typography.captionBold, color: Colors.textSecondary },
  countChipTextActive: { color: Colors.primaryForeground },
  problemCard: { gap: Spacing.two },
  problemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  problemHeaderText: { flex: 1, gap: 4 },
  topicBadge: { ...Typography.captionBold, color: Colors.primary, textTransform: 'uppercase' },
  problemText: { ...Typography.bodyBold, color: Colors.textPrimary },
  problemDetail: { gap: Spacing.two },
  stepRow: { gap: 2 },
  stepText: { ...Typography.body, color: Colors.textPrimary },
  stepFormula: { ...Typography.caption, color: Colors.textSecondary, fontFamily: 'monospace' },
  revealButton: { alignSelf: 'flex-start' },
  revealButtonText: { ...Typography.captionBold, color: Colors.primary },
  answerBox: { backgroundColor: Colors.bgApp, borderRadius: Radius.md, padding: Spacing.two },
  selfCheckLabel: { ...Typography.captionBold, color: Colors.textSecondary, marginTop: Spacing.two },
  answerInput: {
    ...Typography.body, color: Colors.textPrimary, minHeight: 60, textAlignVertical: 'top',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.two,
  },
  feedbackBox: { backgroundColor: `${Colors.blue}1a`, borderRadius: Radius.md, padding: Spacing.two },
  feedbackCorrect: { backgroundColor: `${Colors.emerald}1a` },
  feedbackWrong: { backgroundColor: `${Colors.red}1a` },
  feedbackText: { ...Typography.body, color: Colors.textPrimary },
});

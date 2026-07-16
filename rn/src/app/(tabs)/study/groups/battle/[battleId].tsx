import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ExamReview } from '@/components/study/ExamReview';
import { ExamRunning } from '@/components/study/ExamRunning';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { studyGroupService, type BattlePlay, type BattleResult } from '@/services/studyGroupService';

export default function BattlePlayScreen() {
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const router = useRouter();
  const [play, setPlay] = useState<BattlePlay | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  // Date.now() is a side effect — captured in an effect rather than during render.
  const startedAtRef = useRef(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    studyGroupService.getBattle(battleId).then(setPlay);
  }, [battleId]);

  if (!play) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (result) {
    return (
      <ExamReview
        score={result.score}
        total={result.total}
        items={result.items.map((item) => ({
          key: item.questionId,
          question: item.question,
          userAnswer: item.userAnswer,
          correct: item.correct,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
        }))}
        onClose={() => router.back()}
      >
        <Text style={styles.sectionLabel}>Standings</Text>
        {result.battle.entries.map((entry) => (
          <Text key={entry.userId} style={styles.standingRow}>
            #{entry.rank} {entry.name}{entry.isMe ? ' (you)' : ''} — {entry.score}/{entry.total}
          </Text>
        ))}
      </ExamReview>
    );
  }

  const current = play.questions[index];
  const currentAnswer = answers[current.id];

  const next = async () => {
    if (index + 1 < play.questions.length) {
      setIndex((i) => i + 1);
      return;
    }
    setSubmitting(true);
    try {
      const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      setResult(await studyGroupService.submitBattle(battleId, answers, durationSeconds));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ExamRunning
      current={current}
      index={index}
      total={play.questions.length}
      currentAnswer={currentAnswer}
      onSelectOption={(opt) => setAnswers((prev) => ({ ...prev, [current.id]: opt }))}
      onNext={next}
      submitting={submitting}
      nextLabel="Next"
      submitLabel="Submit"
    />
  );
}

const styles = StyleSheet.create({
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp },
  sectionLabel: { ...Typography.subheading, color: Colors.textPrimary, marginTop: Spacing.two },
  standingRow: { ...Typography.body, color: Colors.textPrimary },
});

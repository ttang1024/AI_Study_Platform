import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ExamResults } from '@/components/study/ExamResults';
import { ExamRunning } from '@/components/study/ExamRunning';
import { ExamSetup } from '@/components/study/ExamSetup';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import type { QuizQuestion } from '@/types';
import { examSessionStore } from '@/utils/examSession';
import { isQuizOptionCorrect, shuffle } from '@/utils/quizAnswers';

type Phase = 'setup' | 'running' | 'results';

export default function TimedExamScreen() {
  // The clock keeps running while the user thinks — never let the screen sleep mid-exam.
  useKeepAwake();
  const router = useRouter();
  const session = useMemo(() => examSessionStore.take(), []);
  const questions = useMemo<QuizQuestion[]>(() => (session ? shuffle(session.questions) : []), [session]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [minutes, setMinutes] = useState(10);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== 'running') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase('results');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  if (!session || questions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No exam session found.</Text>
        <Button title="Close" onPress={() => router.back()} />
      </View>
    );
  }

  const start = () => {
    setSecondsLeft(minutes * 60);
    setPhase('running');
  };

  const current = questions[index];
  const currentAnswer = answers[current?.id];

  const selectOption = (option: string) => {
    setAnswers((prev) => ({ ...prev, [current.id]: option }));
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('results');
    } else {
      setIndex((i) => i + 1);
    }
  };

  const correctCount = questions.filter((q) => answers[q.id] && isQuizOptionCorrect(answers[q.id], q.correctAnswer)).length;

  if (phase === 'setup') {
    return (
      <ExamSetup
        title={session.title}
        questionCount={questions.length}
        minutes={minutes}
        onChangeMinutes={setMinutes}
        onStart={start}
      />
    );
  }

  if (phase === 'running') {
    return (
      <ExamRunning
        current={current}
        index={index}
        total={questions.length}
        secondsLeft={secondsLeft}
        currentAnswer={currentAnswer}
        onSelectOption={selectOption}
        onNext={next}
      />
    );
  }

  return (
    <ExamResults questions={questions} answers={answers} correctCount={correctCount} onClose={() => router.back()} />
  );
}

const styles = StyleSheet.create({
  center: { ...Layout.fillCenter, gap: Spacing.two, backgroundColor: Colors.bgApp },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
});

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarClock } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { PlanCard } from '@/components/study/PlanCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { courseService } from '@/services/courseService';
import { plannerService, type ExamPlan } from '@/services/plannerService';
import type { Course } from '@/types';

const MINUTES_OPTIONS = [20, 40, 60, 90];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function PlannerScreen() {
  const [plans, setPlans] = useState<ExamPlan[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [dailyMinutes, setDailyMinutes] = useState(40);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    plannerService.listExamPlans().then(setPlans);
    courseService.getCourses().then(setCourses).catch(() => {});
  }, []);

  const create = async () => {
    if (!title.trim() || !DATE_PATTERN.test(examDate)) {
      setError('Enter a title and a date as YYYY-MM-DD.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const plan = await plannerService.createExamPlan({ title: title.trim(), examDate, courseId, dailyMinutes });
      setPlans((prev) => (prev ? [plan, ...prev] : [plan]));
      setShowForm(false);
      setTitle('');
      setExamDate('');
    } catch {
      setError("Couldn't create the plan — check the date is today or later.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (planId: string) => {
    Alert.alert('Delete plan', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await plannerService.deleteExamPlan(planId);
          setPlans((prev) => prev?.filter((p) => p.id !== planId) ?? null);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {showForm ? (
        <Card style={styles.form}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Exam title" placeholderTextColor={Colors.textSecondary} style={styles.input} autoFocus />
          <TextInput value={examDate} onChangeText={setExamDate} placeholder="Exam date (YYYY-MM-DD)" placeholderTextColor={Colors.textSecondary} style={styles.input} />
          <View style={styles.chipRow}>
            <FilterChip label="All courses" active={!courseId} onPress={() => setCourseId(undefined)} />
            {courses.map((c) => (
              <FilterChip key={c.id} label={c.name} active={courseId === c.id} onPress={() => setCourseId(c.id)} />
            ))}
          </View>
          <View style={styles.chipRow}>
            {MINUTES_OPTIONS.map((m) => (
              <FilterChip key={m} label={`${m}m/day`} active={dailyMinutes === m} onPress={() => setDailyMinutes(m)} />
            ))}
          </View>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.formActions}>
            <Pressable onPress={() => setShowForm(false)} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Button title={submitting ? 'Creating…' : 'Create Plan'} onPress={create} disabled={submitting} loading={submitting} />
          </View>
        </Card>
      ) : (
        <Button title="New Exam Plan" onPress={() => setShowForm(true)} />
      )}

      {plans === null ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : plans.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No exam plans yet" subtitle="Create one to get a day-by-day study schedule and an AI cram sheet." />
      ) : (
        plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            expanded={expandedId === plan.id}
            onToggle={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
            onDelete={() => remove(plan.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  form: { gap: Spacing.two },
  input: {
    ...Typography.body, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: Spacing.two,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  errorText: { ...Typography.caption, color: Colors.red },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.three, alignItems: 'center' },
  cancelText: { ...Typography.captionBold, color: Colors.textSecondary },
  loading: { marginTop: Spacing.five },
});

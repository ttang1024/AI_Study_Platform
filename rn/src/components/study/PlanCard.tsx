import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Sparkles, Trash2 } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { plannerService, type CramSheet, type ExamPlan, type ExamSchedule } from '@/services/plannerService';
import { routeForTask } from '@/utils/plannerRoutes';

interface PlanCardProps {
  plan: ExamPlan;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

// Memoized — each card lazily fetches its own schedule/cram sheet on expand,
// so expanding one plan shouldn't re-render every other plan in the list.
export const PlanCard: React.FC<PlanCardProps> = React.memo(function PlanCard({ plan, expanded, onToggle, onDelete }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [cramSheet, setCramSheet] = useState<CramSheet | null>(null);
  const [loadingCram, setLoadingCram] = useState(false);

  const toggle = () => {
    onToggle();
    if (!expanded && !schedule) {
      setLoadingSchedule(true);
      plannerService.getSchedule(plan.id).then(setSchedule).finally(() => setLoadingSchedule(false));
    }
  };

  const loadCramSheet = (refresh: boolean) => {
    setLoadingCram(true);
    plannerService.getCramSheet(plan.id, refresh).then(setCramSheet).finally(() => setLoadingCram(false));
  };

  return (
    <Card style={styles.card}>
      <Pressable style={styles.header} onPress={toggle}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{plan.title}</Text>
          <Text style={styles.meta}>
            {new Date(plan.examDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}{plan.daysRemaining} day{plan.daysRemaining === 1 ? '' : 's'} left{plan.courseName ? ` · ${plan.courseName}` : ''}
          </Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Trash2 size={16} color={Colors.red} />
        </Pressable>
        {expanded ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          {loadingSchedule ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            schedule?.days.map((day) => (
              <View key={day.date} style={styles.dayBlock}>
                <Text style={styles.dayLabel}>{day.label} · {day.minutes}m</Text>
                {day.tasks.map((task, i) => (
                  <Pressable
                    key={i}
                    style={styles.taskRow}
                    onPress={() => router.push(task.type === 'mock-exam' ? { pathname: '/study/planner/mock-exam', params: { courseId: plan.courseId ?? '' } } : (routeForTask(task) as never))}
                  >
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskReason}>{task.reason}</Text>
                  </Pressable>
                ))}
              </View>
            ))
          )}

          {!cramSheet ? (
            <Pressable style={styles.cramButton} onPress={() => loadCramSheet(false)} disabled={loadingCram}>
              <Sparkles size={14} color={Colors.primary} />
              <Text style={styles.cramButtonText}>{loadingCram ? 'Generating…' : 'Cram Sheet'}</Text>
            </Pressable>
          ) : (
            <View style={styles.cramSheetBox}>
              <SummaryMarkdown value={cramSheet.markdown} />
              <Pressable onPress={() => loadCramSheet(true)} disabled={loadingCram}>
                <Text style={styles.cramButtonText}>{loadingCram ? 'Regenerating…' : 'Regenerate'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  header: { ...Layout.row, gap: Spacing.two },
  headerText: { flex: 1 },
  title: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  detail: { gap: Spacing.three },
  dayBlock: { gap: 4 },
  dayLabel: { ...Typography.captionBold, color: Colors.primary, textTransform: 'uppercase' },
  taskRow: { paddingVertical: 4, paddingLeft: Spacing.two, borderLeftWidth: 2, borderLeftColor: Colors.border },
  taskTitle: { ...Typography.body, color: Colors.textPrimary },
  taskReason: { ...Typography.caption, color: Colors.textSecondary },
  cramButton: { ...Layout.row, gap: 6, alignSelf: 'flex-start' },
  cramButtonText: { ...Typography.captionBold, color: Colors.primary },
  cramSheetBox: { backgroundColor: Colors.bgApp, borderRadius: Radius.md, padding: Spacing.two, gap: Spacing.two },
});

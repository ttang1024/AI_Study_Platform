import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';

import { Card } from '@/components/Card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { ClassroomAssignment, SubmissionStatus } from '@/services/classroomService';

interface Props {
  assignments: ClassroomAssignment[];
  isGrader: boolean;
  loading: boolean;
  onOpen: (assignmentId: string) => void;
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Handed in',
  late: 'Late',
  graded: 'Graded',
};

const STATUS_COLOR: Record<SubmissionStatus, string> = {
  not_started: Colors.textSecondary,
  draft: Colors.amber,
  submitted: Colors.primary,
  late: Colors.orange,
  graded: Colors.emerald,
};

export const AssignmentsTab: React.FC<Props> = ({ assignments, isGrader, loading, onOpen }) => {
  if (loading) return <ActivityIndicator color={Colors.primary} />;

  if (assignments.length === 0)
    return (
      <Text style={styles.caption}>
        {isGrader
          ? 'No assignments yet. Set work from the web app, then grade it here.'
          : 'Your instructor has not set any work yet.'}
      </Text>
    );

  return (
    <>
      {assignments.map((a) => (
        <Pressable key={a.classroomAssignmentId} onPress={() => onOpen(a.classroomAssignmentId)}>
          <Card style={styles.row}>
            <FileText size={16} color={Colors.primary} />
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {a.title}
                </Text>
                {!a.isPublished && <Text style={styles.draftChip}>Draft</Text>}
              </View>
              <Text style={styles.caption}>
                {a.pointsPossible} points
                {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ''}
              </Text>
            </View>

            {/* Staff see class progress; a student sees only their own state. */}
            {isGrader ? (
              <Text style={styles.caption}>
                {a.submittedCount ?? 0}/{a.studentCount ?? 0}
              </Text>
            ) : a.myPointsAwarded != null ? (
              <Text style={[styles.score, { color: Colors.emerald }]}>
                {a.myPointsAwarded}/{a.pointsPossible}
              </Text>
            ) : (
              a.myStatus && (
                <Text style={[styles.status, { color: STATUS_COLOR[a.myStatus] }]}>
                  {STATUS_LABEL[a.myStatus]}
                </Text>
              )
            )}
          </Card>
        </Pressable>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary, flexShrink: 1 },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  status: { ...Typography.caption },
  score: { ...Typography.subheading },
  draftChip: {
    ...Typography.caption,
    color: Colors.textSecondary,
    backgroundColor: Colors.bgApp,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.sm,
  },
});

export default AssignmentsTab;

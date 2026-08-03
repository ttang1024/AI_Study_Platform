import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Lock from 'lucide-react-native/icons/lock';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { ClassroomAssignmentDetail, ClassroomSubmission } from '@/services/classroomService';

interface Props {
  detail: ClassroomAssignmentDetail | null;
  readOnly: boolean;
  onClose: () => void;
  onSaveSubmission: (assignmentId: string, text: string, submit: boolean) => Promise<void>;
  onGrade: (
    assignmentId: string,
    studentUserId: string,
    points: number | null,
    feedback?: string,
  ) => Promise<void>;
}

/**
 * One assignment, opened full-screen.
 *
 * Which half renders comes from the payload, not a role prop: the server sends `mySubmission` to a
 * student and `submissions` to staff, never both. Deciding it here from the data keeps the privacy
 * rule on the server, where it is enforceable.
 */
export const AssignmentSheet: React.FC<Props> = ({
  detail,
  readOnly,
  onClose,
  onSaveSubmission,
  onGrade,
}) => (
  <Modal visible={detail !== null} animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {detail && (
          <>
            <Text style={styles.title}>{detail.assignment.title}</Text>
            <Text style={styles.caption}>
              {detail.assignment.pointsPossible} points
              {detail.assignment.dueAt
                ? ` · due ${new Date(detail.assignment.dueAt).toLocaleString()}`
                : ''}
            </Text>

            {!!detail.assignment.instructions && (
              <>
                <Text style={styles.sectionLabel}>Instructions</Text>
                <Text style={styles.body}>{detail.assignment.instructions}</Text>
              </>
            )}

            {detail.submissions !== null ? (
              <GradingList
                submissions={detail.submissions}
                pointsPossible={detail.assignment.pointsPossible}
                readOnly={readOnly}
                onGrade={(studentUserId, points, feedback) =>
                  onGrade(detail.assignment.classroomAssignmentId, studentUserId, points, feedback)
                }
              />
            ) : (
              <StudentSubmission
                submission={detail.mySubmission}
                pointsPossible={detail.assignment.pointsPossible}
                dueAt={detail.assignment.dueAt}
                allowLate={detail.assignment.allowLateSubmissions}
                readOnly={readOnly}
                onSave={(text, submit) =>
                  onSaveSubmission(detail.assignment.classroomAssignmentId, text, submit)
                }
              />
            )}
          </>
        )}

        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>
);

// ── Student half ────────────────────────────────────────────────────────────

const StudentSubmission: React.FC<{
  submission: ClassroomSubmission | null;
  pointsPossible: number;
  dueAt?: string;
  allowLate: boolean;
  readOnly: boolean;
  onSave: (text: string, submit: boolean) => Promise<void>;
}> = ({ submission, pointsPossible, dueAt, allowLate, readOnly, onSave }) => {
  const serverText = submission?.text ?? '';
  const [text, setText] = useState(serverText);
  const [syncedWith, setSyncedWith] = useState(serverText);
  const [busy, setBusy] = useState(false);

  // A save or a grade re-fetches the assignment, and whatever the server now holds replaces what is
  // in the box. Adjusted during render rather than in an effect: React re-runs this component before
  // committing, so the box never paints one frame of stale text.
  if (serverText !== syncedWith) {
    setSyncedWith(serverText);
    setText(serverText);
  }

  const isGraded = submission?.status === 'graded';
  const pastDue = dueAt != null && new Date(dueAt) < new Date();
  const locked = readOnly || isGraded || (pastDue && !allowLate);

  const save = async (submit: boolean) => {
    setBusy(true);
    try {
      await onSave(text, submit);
      // Success dismisses the sheet, so busy is left set: the slide-out animation keeps this mounted
      // for a moment, and re-enabling would offer a second click that submits the same thing twice.
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={styles.sectionLabel}>Your work</Text>

      {isGraded && (
        <Card style={styles.graded}>
          <Text style={styles.gradedScore}>
            Graded: {submission?.pointsAwarded}/{pointsPossible}
          </Text>
          {!!submission?.feedback && <Text style={styles.body}>{submission.feedback}</Text>}
        </Card>
      )}

      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        editable={!locked}
        placeholder="Write your answer. Drafts are private until you hand in."
        placeholderTextColor={Colors.textSecondary}
        style={[styles.textArea, locked && styles.textAreaLocked]}
      />

      {locked ? (
        <View style={styles.lockRow}>
          <Lock size={14} color={Colors.textSecondary} />
          <Text style={styles.caption}>
            {isGraded
              ? 'Graded work is locked. Ask your instructor to clear the grade to revise.'
              : 'This assignment is closed.'}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button title="Save draft" variant="secondary" onPress={() => void save(false)} disabled={busy} />
          </View>
          <View style={styles.flex}>
            <Button
              title={submission?.submittedAt ? 'Hand in again' : 'Hand in'}
              onPress={() => void save(true)}
              disabled={busy || !text.trim()}
              loading={busy}
            />
          </View>
        </View>
      )}
    </>
  );
};

// ── Staff half ──────────────────────────────────────────────────────────────

const GradingList: React.FC<{
  submissions: ClassroomSubmission[];
  pointsPossible: number;
  readOnly: boolean;
  onGrade: (studentUserId: string, points: number | null, feedback?: string) => Promise<void>;
}> = ({ submissions, pointsPossible, readOnly, onGrade }) => {
  const [openStudent, setOpenStudent] = useState<string | null>(null);

  if (submissions.length === 0)
    return <Text style={styles.caption}>No students are enrolled yet.</Text>;

  return (
    <>
      <Text style={styles.sectionLabel}>Submissions</Text>
      {submissions.map((s) => {
        const handedIn = s.status !== 'not_started' && s.status !== 'draft';
        const isOpen = openStudent === s.studentUserId;
        return (
          <Card key={s.studentUserId} style={styles.submissionCard}>
            <Pressable
              style={styles.submissionHeader}
              onPress={() => handedIn && setOpenStudent(isOpen ? null : s.studentUserId)}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {s.studentName}
              </Text>
              <Text style={styles.caption}>
                {s.status === 'not_started'
                  ? 'Not started'
                  : s.status === 'draft'
                    ? 'Draft'
                    : s.status === 'graded'
                      ? `${s.pointsAwarded}/${pointsPossible}`
                      : s.status === 'late'
                        ? 'Late'
                        : 'Handed in'}
              </Text>
            </Pressable>

            {isOpen && handedIn && (
              <GradeForm
                submission={s}
                pointsPossible={pointsPossible}
                readOnly={readOnly}
                onGrade={(points, feedback) => onGrade(s.studentUserId, points, feedback)}
              />
            )}
          </Card>
        );
      })}
    </>
  );
};

const GradeForm: React.FC<{
  submission: ClassroomSubmission;
  pointsPossible: number;
  readOnly: boolean;
  onGrade: (points: number | null, feedback?: string) => Promise<void>;
}> = ({ submission, pointsPossible, readOnly, onGrade }) => {
  const [points, setPoints] = useState(
    submission.pointsAwarded != null ? String(submission.pointsAwarded) : '',
  );
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [busy, setBusy] = useState(false);

  const submitGrade = async (clear: boolean) => {
    setBusy(true);
    try {
      await onGrade(clear ? null : Number(points), feedback.trim() || undefined);
      // Releasing a grade dismisses the sheet; clearing keeps it up, so hand the buttons back.
      if (clear) setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gradeForm}>
      <Text style={styles.body}>{submission.text}</Text>

      {!readOnly && (
        <>
          <Text style={styles.fieldLabel}>Score out of {pointsPossible}</Text>
          <TextInput
            value={points}
            onChangeText={setPoints}
            keyboardType="numeric"
            style={styles.input}
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Feedback</Text>
          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            multiline
            style={[styles.input, styles.inputMultiline]}
            placeholderTextColor={Colors.textSecondary}
          />

          <View style={styles.actions}>
            {submission.status === 'graded' && (
              <View style={styles.flex}>
                <Button
                  title="Clear grade"
                  variant="secondary"
                  onPress={() => void submitGrade(true)}
                  disabled={busy}
                />
              </View>
            )}
            <View style={styles.flex}>
              <Button
                title="Release grade"
                onPress={() => void submitGrade(false)}
                disabled={busy || points === ''}
                loading={busy}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  flex: { flex: 1 },
  title: { ...Typography.screenTitle, color: Colors.textPrimary },
  caption: { ...Typography.caption, color: Colors.textSecondary, flexShrink: 1 },
  body: { ...Typography.body, color: Colors.textPrimary },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary, flexShrink: 1 },
  sectionLabel: {
    ...Typography.captionBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: Spacing.two,
  },
  fieldLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.two },
  textArea: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  textAreaLocked: { opacity: 0.6 },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  graded: { gap: Spacing.one, backgroundColor: Colors.bgCard },
  gradedScore: { ...Typography.bodyBold, color: Colors.emerald },
  submissionCard: { padding: Spacing.three, gap: Spacing.two },
  submissionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  gradeForm: { gap: Spacing.one, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.two },
  closeButton: {
    marginTop: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  closeText: { ...Typography.bodyBold, color: Colors.white },
});

export default AssignmentSheet;

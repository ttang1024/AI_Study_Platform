import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BookOpen from 'lucide-react-native/icons/book-open';
import Check from 'lucide-react-native/icons/check';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Copy from 'lucide-react-native/icons/copy';
import Users from 'lucide-react-native/icons/users';

import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { TabChipRow, type TabChipOption } from '@/components/TabChipRow';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import {
  classroomService,
  type ClassroomDetail,
  type Gradebook,
  type StudentProgress,
} from '@/services/classroomService';

type Tab = 'courses' | 'gradebook' | 'roster';

const TAB_OPTIONS: Record<Tab, TabChipOption<Tab>> = {
  courses: { id: 'courses', label: 'Courses', icon: BookOpen },
  gradebook: { id: 'gradebook', label: 'Gradebook', icon: ClipboardList },
  roster: { id: 'roster', label: 'Roster', icon: Users },
};

const scoreColor = (percent: number): string =>
  percent >= 80 ? Colors.emerald : percent >= 60 ? Colors.amber : Colors.red;

export default function ClassroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  const [detail, setDetail] = useState<ClassroomDetail | null>(null);
  const [gradebook, setGradebook] = useState<Gradebook | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [tab, setTab] = useState<Tab>('courses');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const isGrader = detail ? detail.myRole !== 'student' : false;

  const load = useCallback(async () => {
    try {
      const res = await classroomService.getClassroom(id);
      const data = res.data?.data ?? null;
      setDetail(data);
      if (data) navigation.setOptions({ title: data.name });
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only for graders: the endpoint 403s for students, and firing it anyway would put a guaranteed
  // failed request in every student's session.
  useEffect(() => {
    if (!isGrader) return;
    void (async () => {
      try {
        const res = await classroomService.getGradebook(id);
        setGradebook(res.data?.data ?? null);
      } catch {
        setGradebook(null);
      }
    })();
  }, [isGrader, id]);

  const openStudent = async (studentUserId: string) => {
    try {
      const res = await classroomService.getStudentProgress(id, studentUserId);
      setProgress(res.data?.data ?? null);
    } catch {
      setProgress(null);
    }
  };

  const copyCode = async () => {
    if (!detail?.joinCode) return;
    await Clipboard.setStringAsync(detail.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.caption}>This classroom is unavailable.</Text>
      </View>
    );
  }

  const tabs: Tab[] = isGrader ? ['courses', 'gradebook', 'roster'] : ['courses', 'roster'];

  return (
    <View style={styles.screen}>
      {/* The join code is a bearer credential for the roster — the server only sends it to someone
          who can manage the classroom, so its presence is the permission check. */}
      {!!detail.joinCode && (
        <Pressable style={styles.codeRow} onPress={copyCode}>
          <Text style={styles.code}>{detail.joinCode}</Text>
          {copied ? <Check size={16} color={Colors.emerald} /> : <Copy size={16} color={Colors.textSecondary} />}
        </Pressable>
      )}

      <TabChipRow tabs={tabs.map((t) => TAB_OPTIONS[t])} active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'courses' && (
          detail.courses.length === 0 ? (
            <Text style={styles.caption}>
              {isGrader
                ? 'No courses assigned yet. Assign one from the web app so students can study it.'
                : 'Your instructor has not assigned any courses yet.'}
            </Text>
          ) : (
            detail.courses.map((c) => (
              <Card key={c.classroomCourseId} style={styles.row}>
                <BookOpen size={16} color={Colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{c.courseName}</Text>
                  {!!c.dueAt && (
                    <Text style={styles.caption}>Due {new Date(c.dueAt).toLocaleDateString()}</Text>
                  )}
                </View>
              </Card>
            ))
          )
        )}

        {tab === 'roster' &&
          detail.roster.map((r) => (
            <Card key={r.userId} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{r.fullName}</Text>
                <Text style={styles.caption}>{r.email}</Text>
              </View>
              <Text style={styles.roleChip}>{r.role}</Text>
            </Card>
          ))}

        {tab === 'gradebook' &&
          (!gradebook ? (
            <ActivityIndicator color={Colors.primary} />
          ) : gradebook.rows.length === 0 ? (
            <Text style={styles.caption}>No students have enrolled yet.</Text>
          ) : (
            gradebook.rows.map((row) => (
              <Pressable key={row.userId} onPress={() => openStudent(row.userId)}>
                <Card style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{row.fullName}</Text>
                    <Text style={styles.caption}>
                      {row.totalStudyMinutes}m studied
                      {row.lastActivityAt
                        ? ` · last active ${new Date(row.lastActivityAt).toLocaleDateString()}`
                        : ' · no activity'}
                    </Text>
                  </View>
                  {/* Null, not zero: "not started" and "scored 0%" must not look alike. */}
                  {row.overallScorePercent === null ? (
                    <Text style={styles.caption}>—</Text>
                  ) : (
                    <Text style={[styles.score, { color: scoreColor(row.overallScorePercent) }]}>
                      {row.overallScorePercent}%
                    </Text>
                  )}
                </Card>
              </Pressable>
            ))
          ))}
      </ScrollView>

      <Modal visible={progress !== null} animationType="slide" onRequestClose={() => setProgress(null)}>
        <View style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{progress?.fullName}</Text>
            <Text style={styles.caption}>{progress?.email}</Text>

            <Text style={styles.sectionLabel}>Weakest topics</Text>
            {progress?.weakestTopics.length === 0 ? (
              <Text style={styles.caption}>
                No worked-problem attempts yet — topics appear once this student practises.
              </Text>
            ) : (
              progress?.weakestTopics.map((t) => {
                const pct = t.attempted === 0 ? 0 : t.correct / t.attempted;
                return (
                  <View key={t.topic} style={styles.topic}>
                    <View style={styles.topicHeader}>
                      <Text style={styles.rowTitle}>{t.topic}</Text>
                      <Text style={styles.caption}>
                        {t.correct}/{t.attempted}
                      </Text>
                    </View>
                    <ProgressBar progress={pct} color={pct >= 0.6 ? Colors.emerald : Colors.red} />
                  </View>
                );
              })
            )}

            <Pressable style={styles.closeButton} onPress={() => setProgress(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  title: { ...Typography.screenTitle, color: Colors.textPrimary },
  sectionLabel: {
    ...Typography.captionBold, color: Colors.textSecondary,
    textTransform: 'uppercase', marginTop: Spacing.two,
  },
  score: { ...Typography.subheading },
  roleChip: { ...Typography.caption, color: Colors.textSecondary, textTransform: 'capitalize' },
  codeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two,
    paddingVertical: Spacing.two, backgroundColor: Colors.bgSidebar,
  },
  code: { ...Typography.subheading, color: Colors.textPrimary, letterSpacing: 3 },
  topic: { gap: 4 },
  topicHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  closeButton: {
    marginTop: Spacing.four, paddingVertical: Spacing.two,
    borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center',
  },
  closeText: { ...Typography.bodyBold, color: Colors.white },
});

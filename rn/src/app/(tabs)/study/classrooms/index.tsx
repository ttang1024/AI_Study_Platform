import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Building2 from 'lucide-react-native/icons/building-2';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import LogIn from 'lucide-react-native/icons/log-in';
import Plus from 'lucide-react-native/icons/plus';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import {
  classroomService,
  type Classroom,
  type ClassroomDeadline,
  type Organization,
} from '@/services/classroomService';

type Sheet = 'join' | 'create' | 'org' | null;

export default function ClassroomsScreen() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [deadlines, setDeadlines] = useState<ClassroomDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ joinCode: '', name: '', orgName: '', organizationId: '' });
  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    const [c, o, d] = await Promise.allSettled([
      classroomService.getMyClassrooms(),
      classroomService.getMyOrganizations(),
      classroomService.getDeadlines(),
    ]);
    if (c.status === 'fulfilled') setClassrooms(c.value.data?.data ?? []);
    if (o.status === 'fulfilled') setOrganizations(o.value.data?.data ?? []);
    if (d.status === 'fulfilled') setDeadlines(d.value.data?.data ?? []);
    setLoading(false);
  }, []);

  // Wrapped so every setState lands in an async continuation rather than the effect body. Each
  // `load` begins with an await, so nothing was setting state synchronously anyway — this just
  // makes that visible to the compiler's effect analysis.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const close = () => {
    setSheet(null);
    setError('');
    setForm({ joinCode: '', name: '', orgName: '', organizationId: '' });
  };

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      await classroomService.joinClassroom(form.joinCode.trim().toUpperCase());
      await load();
      close();
    } catch {
      setError('That join code is not valid, or you are already enrolled.');
    } finally {
      setBusy(false);
    }
  };

  const createOrg = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await classroomService.createOrganization(form.orgName.trim());
      const created = res.data?.data;
      if (created) {
        setOrganizations((prev) => [created, ...prev]);
        // Roll straight into creating a classroom — an organization with none is not useful yet.
        setForm({ joinCode: '', name: '', orgName: '', organizationId: created.organizationId });
        setSheet('create');
      }
    } catch {
      setError('Could not create that organization.');
    } finally {
      setBusy(false);
    }
  };

  const createClassroom = async () => {
    setBusy(true);
    setError('');
    try {
      await classroomService.createClassroom({
        organizationId: form.organizationId || organizations[0]?.organizationId || '',
        name: form.name.trim(),
      });
      await load();
      close();
    } catch {
      setError('Could not create that classroom.');
    } finally {
      setBusy(false);
    }
  };

  const teaching = classrooms.filter((c) => c.myRole !== 'student');
  const enrolled = classrooms.filter((c) => c.myRole === 'student');

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {classrooms.length === 0 ? (
          <View style={styles.empty}>
            <GraduationCap size={32} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No classrooms yet</Text>
            <Text style={styles.emptyBody}>
              Students: enter the join code your instructor gave you. Instructors: create a classroom
              and assign courses from your library.
            </Text>
          </View>
        ) : (
          <>
            {deadlines.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Due soon</Text>
                {deadlines.map((d) => (
                  <Pressable
                    key={`${d.classroomAssignmentId ?? d.courseId}-${d.dueAt}`}
                    onPress={() => router.push(`/study/classrooms/${d.classroomId}` as never)}
                  >
                    <Card style={styles.deadline}>
                      <CalendarClock size={16} color={d.isOverdue ? Colors.red : Colors.primary} />
                      <View style={styles.deadlineBody}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {d.title}
                        </Text>
                        <Text style={styles.caption} numberOfLines={1}>
                          {d.classroomName}
                        </Text>
                      </View>
                      <Text style={[styles.caption, d.isOverdue && { color: Colors.red }]}>
                        {d.isOverdue ? 'Overdue' : new Date(d.dueAt).toLocaleDateString()}
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
            {teaching.length > 0 && (
              <Section title="Teaching" items={teaching} onOpen={(id) => router.push(`/study/classrooms/${id}` as never)} />
            )}
            {enrolled.length > 0 && (
              <Section title="Enrolled" items={enrolled} onOpen={(id) => router.push(`/study/classrooms/${id}` as never)} />
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryAction} onPress={() => setSheet('join')}>
          <LogIn size={16} color={Colors.primary} />
          <Text style={styles.secondaryText}>Join a class</Text>
        </Pressable>
        <Pressable
          style={styles.primaryAction}
          onPress={() => setSheet(organizations.length ? 'create' : 'org')}
        >
          <Plus size={16} color={Colors.white} />
          <Text style={styles.primaryText}>New classroom</Text>
        </Pressable>
      </View>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {sheet === 'join' && (
              <>
                <Text style={styles.sheetTitle}>Join a classroom</Text>
                <TextInput
                  value={form.joinCode}
                  onChangeText={(v) => update({ joinCode: v.toUpperCase() })}
                  placeholder="ABCD2345"
                  autoCapitalize="characters"
                  placeholderTextColor={Colors.textSecondary}
                  style={[styles.input, styles.code]}
                />
                <Button title={busy ? 'Joining…' : 'Join'} onPress={join} disabled={busy || !form.joinCode.trim()} />
              </>
            )}

            {sheet === 'org' && (
              <>
                <Text style={styles.sheetTitle}>Create an organization</Text>
                <Text style={styles.sheetBody}>
                  Classrooms belong to an organization — a school, department, or course group. You
                  will be its owner.
                </Text>
                <TextInput
                  value={form.orgName}
                  onChangeText={(v) => update({ orgName: v })}
                  placeholder="Riverside High School"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.input}
                />
                <Button title={busy ? 'Working…' : 'Continue'} onPress={createOrg} disabled={busy || !form.orgName.trim()} />
              </>
            )}

            {sheet === 'create' && (
              <>
                <Text style={styles.sheetTitle}>New classroom</Text>
                <TextInput
                  value={form.name}
                  onChangeText={(v) => update({ name: v })}
                  placeholder="Physics 101 — Fall"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.input}
                />
                <Button title={busy ? 'Creating…' : 'Create'} onPress={createClassroom} disabled={busy || !form.name.trim()} />
              </>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const Section: React.FC<{ title: string; items: Classroom[]; onOpen: (id: string) => void }> = ({
  title, items, onOpen,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>{title}</Text>
    {items.map((c) => (
      <Pressable key={c.classroomId} onPress={() => onOpen(c.classroomId)}>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <GraduationCap size={18} color={Colors.primary} />
            {c.isArchived && <Text style={styles.archived}>Archived</Text>}
          </View>
          <Text style={styles.cardTitle}>{c.name}</Text>
          <View style={styles.orgRow}>
            <Building2 size={12} color={Colors.textSecondary} />
            <Text style={styles.caption}>{c.organizationName}</Text>
          </View>
          <Text style={styles.caption}>
            {c.studentCount} student{c.studentCount === 1 ? '' : 's'} · {c.courseCount} course
            {c.courseCount === 1 ? '' : 's'}
          </Text>
        </Card>
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  section: { gap: Spacing.two },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  card: { padding: Spacing.three, gap: 4 },
  deadline: { padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deadlineBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...Typography.subheading, color: Colors.textPrimary },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  archived: { ...Typography.caption, color: Colors.textSecondary },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyTitle: { ...Typography.subheading, color: Colors.textPrimary },
  emptyBody: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSidebar,
  },
  secondaryAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.two, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  secondaryText: { ...Typography.bodyBold, color: Colors.primary },
  primaryAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.primary,
  },
  primaryText: { ...Typography.bodyBold, color: Colors.white },
  backdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgSidebar,
    padding: Spacing.four,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    gap: Spacing.two,
  },
  sheetTitle: { ...Typography.subheading, color: Colors.textPrimary },
  sheetBody: { ...Typography.caption, color: Colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: Spacing.two,
    color: Colors.textPrimary, backgroundColor: Colors.bgApp,
  },
  code: { letterSpacing: 3, fontWeight: '700' },
  error: { ...Typography.caption, color: Colors.red },
});

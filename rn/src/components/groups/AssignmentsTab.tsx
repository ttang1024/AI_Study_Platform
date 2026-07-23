import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Circle from 'lucide-react-native/icons/circle';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Trash2 from 'lucide-react-native/icons/trash-2';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { studyGroupService, type Assignment } from '@/services/studyGroupService';

// Assignment linkUrl can be an app-internal web path like "/quizzes" — those don't map
// onto this app's routes, so only absolute http(s) links get an "open" affordance here.
const isOpenableLink = (url?: string) => !!url && /^https?:\/\//i.test(url);

export const AssignmentsTab: React.FC<{ groupId: string; isOwner: boolean }> = ({ groupId, isOwner }) => {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    studyGroupService.listAssignments(groupId).then(setAssignments).catch(() => setAssignments([]));
  }, [groupId]);

  const create = async () => {
    if (!title.trim()) return;
    if (dueAt.trim() && Number.isNaN(Date.parse(dueAt.trim()))) {
      setCreateError('Due date must look like 2026-07-31.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const created = await studyGroupService.createAssignment(groupId, {
        title: title.trim(),
        description: description.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        dueAt: dueAt.trim() ? new Date(dueAt.trim()).toISOString() : undefined,
      });
      setShowForm(false);
      setTitle(''); setDescription(''); setLinkUrl(''); setDueAt('');
      setAssignments((prev) => (prev ? [created, ...prev] : [created]));
    } catch {
      setCreateError('Failed to post assignment.');
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (a: Assignment) => {
    try {
      const updated = await studyGroupService.setAssignmentCompletion(a.id, !a.completedByMe);
      setAssignments((list) => (list ? list.map((x) => (x.id === a.id ? updated : x)) : list));
    } catch { /* leave checkbox unchanged */ }
  };

  const remove = async (a: Assignment) => {
    try {
      await studyGroupService.deleteAssignment(a.id);
      setAssignments((list) => (list ? list.filter((x) => x.id !== a.id) : list));
    } catch { /* assignment stays on failure */ }
  };

  const isOverdue = (a: Assignment) => !!a.dueAt && !a.completedByMe && new Date(a.dueAt) < new Date();

  if (assignments === null) {
    return <ActivityIndicator style={{ marginTop: Spacing.five }} color={Colors.primary} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      {isOwner && (
        showForm ? (
          <Card style={styles.form}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Assignment title (e.g. Read chapter 3)"
              placeholderTextColor={Colors.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Details (optional)"
              placeholderTextColor={Colors.textSecondary}
              style={[styles.input, styles.multiline]}
              multiline
            />
            <TextInput
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="Link (optional, e.g. https://…)"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={dueAt}
              onChangeText={setDueAt}
              placeholder="Due date (optional, YYYY-MM-DD)"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {!!createError && <Text style={styles.errorText}>{createError}</Text>}
            <View style={styles.formActions}>
              <Pressable onPress={() => setShowForm(false)} disabled={creating}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Button title={creating ? 'Posting…' : 'Post'} onPress={create} disabled={creating || !title.trim()} loading={creating} />
            </View>
          </Card>
        ) : (
          <Button title="Post Assignment" onPress={() => setShowForm(true)} />
        )
      )}

      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          subtitle={isOwner ? 'Post the first assignment for your group.' : 'The group owner hasn’t posted any assignments.'}
        />
      ) : (
        assignments.map((a) => (
          <Card key={a.id} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <Pressable onPress={() => toggle(a)} hitSlop={8} style={styles.checkWrap}>
                {a.completedByMe
                  ? <View style={styles.checkOn}><Check size={13} color={Colors.primaryForeground} strokeWidth={3} /></View>
                  : <Circle size={20} color={Colors.zinc300} />}
              </Pressable>
              <View style={styles.itemBody}>
                <Text style={[styles.itemTitle, a.completedByMe && styles.itemTitleDone]}>{a.title}</Text>
                {!!a.description && <Text style={styles.itemDescription}>{a.description}</Text>}
                <View style={styles.metaRow}>
                  {!!a.dueAt && (
                    <Text style={[styles.metaText, isOverdue(a) && styles.metaOverdue]}>
                      due {new Date(a.dueAt).toLocaleDateString()}
                    </Text>
                  )}
                  <Text style={styles.metaText}>{a.completedCount}/{a.memberCount} done</Text>
                  {isOpenableLink(a.linkUrl) && (
                    <Pressable onPress={() => Linking.openURL(a.linkUrl!)} hitSlop={6} style={styles.linkButton}>
                      <ExternalLink size={11} color={Colors.primary} />
                      <Text style={styles.linkText}>open</Text>
                    </Pressable>
                  )}
                </View>
                {isOwner && a.completions.length > 0 && (
                  <Text style={styles.completionsText} numberOfLines={1}>
                    Done: {a.completions.map((c) => c.name).join(', ')}
                  </Text>
                )}
              </View>
              {isOwner && (
                <Pressable onPress={() => remove(a)} hitSlop={8}>
                  <Trash2 size={15} color={Colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  form: { gap: Spacing.two },
  input: {
    ...Typography.body, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, padding: Spacing.two,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  errorText: { ...Typography.caption, color: Colors.errorText },
  formActions: { ...Layout.row, justifyContent: 'flex-end', gap: Spacing.three },
  cancelText: { ...Typography.captionBold, color: Colors.textSecondary },
  itemCard: { padding: Spacing.three },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  checkWrap: { marginTop: 1 },
  checkOn: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.emerald,
    ...Layout.center,
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { ...Typography.bodyBold, fontSize: 14, color: Colors.textPrimary },
  itemTitleDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  itemDescription: { ...Typography.caption, color: Colors.textSecondary },
  metaRow: { ...Layout.rowWrap, gap: Spacing.two, marginTop: 2 },
  metaText: { fontSize: 11, color: Colors.textSecondary },
  metaOverdue: { color: Colors.red, fontWeight: '700' },
  linkButton: { ...Layout.row, gap: 3 },
  linkText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  completionsText: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
});

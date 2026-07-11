import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Users } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { IconBadge } from '@/components/IconBadge';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { studyGroupService, type StudyGroup } from '@/services/studyGroupService';

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<StudyGroup[] | null>(null);
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => studyGroupService.listMyGroups().then(setGroups);

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const group = await studyGroupService.createGroup(name.trim(), description.trim() || undefined);
      setGroups((prev) => (prev ? [group, ...prev] : [group]));
      setMode('none');
      setName('');
      setDescription('');
    } catch {
      setError("Couldn't create the group. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const join = async () => {
    if (inviteCode.trim().length !== 8) return;
    setSubmitting(true);
    setError(null);
    try {
      const group = await studyGroupService.joinGroup(inviteCode.trim().toUpperCase());
      setGroups((prev) => (prev ? [group, ...prev] : [group]));
      setMode('none');
      setInviteCode('');
    } catch {
      setError('Invalid or already-used invite code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {mode === 'none' && (
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <Button title="Create group" onPress={() => setMode('create')} />
          </View>
          <View style={styles.actionButton}>
            <Button title="Join group" variant="secondary" onPress={() => setMode('join')} />
          </View>
        </View>
      )}

      {mode === 'create' && (
        <Card style={styles.form}>
          <TextInput value={name} onChangeText={setName} placeholder="Group name" placeholderTextColor={Colors.textSecondary} style={styles.input} autoFocus />
          <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={Colors.textSecondary} style={styles.input} />
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.formActions}>
            <Pressable onPress={() => setMode('none')} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Button title={submitting ? 'Creating…' : 'Create'} onPress={create} disabled={submitting || !name.trim()} loading={submitting} />
          </View>
        </Card>
      )}

      {mode === 'join' && (
        <Card style={styles.form}>
          <TextInput
            value={inviteCode}
            onChangeText={(t) => setInviteCode(t.toUpperCase().slice(0, 8))}
            placeholder="8-character invite code"
            placeholderTextColor={Colors.textSecondary}
            style={styles.input}
            autoCapitalize="characters"
            maxLength={8}
            autoFocus
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.formActions}>
            <Pressable onPress={() => setMode('none')} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Button title={submitting ? 'Joining…' : 'Join'} onPress={join} disabled={submitting || inviteCode.length !== 8} loading={submitting} />
          </View>
        </Card>
      )}

      {groups === null ? (
        <ActivityIndicator style={{ marginTop: Spacing.five }} color={Colors.primary} />
      ) : groups.length === 0 ? (
        <EmptyState icon={Users} title="No study groups yet" subtitle="Create one or join with an invite code from a friend." />
      ) : (
        groups.map((group) => (
          <Pressable
            key={group.studyGroupId}
            style={({ pressed }) => [styles.groupCard, pressed && styles.pressedDim]}
            onPress={() => router.push(`/study/groups/${group.studyGroupId}`)}
          >
            <IconBadge icon={Users} color={Colors.purple} size={40} iconSize={18} />
            <View style={styles.groupBody}>
              <Text style={styles.groupName}>{group.name}</Text>
              {!!group.description && <Text style={styles.groupDescription} numberOfLines={2}>{group.description}</Text>}
              <Text style={styles.groupMeta}>{group.memberCount} member{group.memberCount === 1 ? '' : 's'} · Code: {group.inviteCode}</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  actionButton: { flex: 1 },
  form: { gap: Spacing.two },
  input: {
    ...Typography.body, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: Spacing.two,
  },
  errorText: { ...Typography.caption, color: Colors.red },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.three, alignItems: 'center' },
  cancelText: { ...Typography.captionBold, color: Colors.textSecondary },
  pressedDim: { opacity: 0.85 },
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three,
    ...Shadows.card,
  },
  groupBody: { flex: 1, gap: 2 },
  groupName: { ...Typography.bodyBold, color: Colors.textPrimary },
  groupDescription: { ...Typography.caption, color: Colors.textSecondary },
  groupMeta: { ...Typography.caption, color: Colors.primary },
});

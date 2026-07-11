import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Copy, LogOut, Trash2, Users } from 'lucide-react-native';

import { AssignmentsTab } from '@/components/groups/AssignmentsTab';
import { BattlesTab } from '@/components/groups/BattlesTab';
import { GroupChatView } from '@/components/groups/GroupChatView';
import { LeaderboardTab } from '@/components/groups/LeaderboardTab';
import { MembersTab } from '@/components/groups/MembersTab';
import { SharedCoursesTab } from '@/components/groups/SharedCoursesTab';
import { StudyRoomTab } from '@/components/groups/StudyRoomTab';
import { Colors, Gradients, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  GroupChatSocket, type ConnectionState, type GroupChatMessage, type StudyRoomState,
} from '@/services/groupChatSocket';
import { studyGroupService, type StudyGroupDetail } from '@/services/studyGroupService';

type Tab = 'chat' | 'room' | 'members' | 'courses' | 'leaderboard' | 'battles' | 'assignments';
const TABS: { value: Tab; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'room', label: 'Room' },
  { value: 'members', label: 'Members' },
  { value: 'courses', label: 'Courses' },
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'battles', label: 'Battles' },
  { value: 'assignments', label: 'Assignments' },
];

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [group, setGroup] = useState<StudyGroupDetail | null>(null);
  const [tab, setTab] = useState<Tab>('chat');
  const [copied, setCopied] = useState(false);

  // The screen owns the hub connection so live chat AND the study room keep
  // working while switching tabs (room presence is dropped server-side the
  // moment the connection closes).
  const socketRef = useRef<GroupChatSocket | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [roomState, setRoomState] = useState<StudyRoomState | null>(null);

  useEffect(() => {
    studyGroupService.getGroupDetail(id).then(setGroup);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    studyGroupService.getChatHistory(id).then((history) => {
      if (!cancelled) setMessages(history);
    }).finally(() => {
      if (!cancelled) setChatLoading(false);
    });

    const socket = new GroupChatSocket();
    socketRef.current = socket;
    socket.connect(id, {
      onMessage: (message) => setMessages((prev) => [...prev, message]),
      onRoomState: setRoomState,
      onConnectionStateChange: setConnectionState,
    }).catch(() => setConnectionState('disconnected'));

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [id]);

  const isOwner = group?.members.find((m) => m.userId === user?.id)?.role === 'owner';

  const copyInviteCode = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leaveOrDelete = () => {
    if (!group) return;
    const isDelete = isOwner;
    Alert.alert(
      isDelete ? 'Delete group' : 'Leave group',
      isDelete ? 'This deletes the group for everyone. This cannot be undone.' : 'You can rejoin later with the invite code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isDelete ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (isDelete) await studyGroupService.deleteGroup(group.studyGroupId);
            else await studyGroupService.leaveGroup(group.studyGroupId);
            router.back();
          },
        },
      ],
    );
  };

  if (!group) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={Gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + Spacing.two }]}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.glassButton} hitSlop={8} onPress={() => router.back()}>
            <ChevronLeft size={22} color={Colors.white} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
          <Pressable style={styles.glassButton} hitSlop={8} onPress={leaveOrDelete}>
            {isOwner ? <Trash2 size={18} color={Colors.white} /> : <LogOut size={18} color={Colors.white} />}
          </Pressable>
        </View>

        <View style={styles.pillRow}>
          <Pressable style={styles.glassPill} onPress={copyInviteCode}>
            {copied ? <Check size={13} color={Colors.white} /> : <Copy size={13} color={Overlay.onGradientMuted} />}
            <Text style={styles.pillText}>{copied ? 'Copied!' : group.inviteCode}</Text>
          </Pressable>
          <View style={styles.glassPill}>
            <Users size={13} color={Overlay.onGradientMuted} />
            <Text style={styles.pillText}>{group.members.length} member{group.members.length === 1 ? '' : 's'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable
              key={t.value}
              style={[styles.tabChip, tab === t.value && styles.tabChipActive]}
              onPress={() => setTab(t.value)}
            >
              <Text style={[styles.tabChipText, tab === t.value && styles.tabChipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.tabContent}>
        {tab === 'chat' && (
          <GroupChatView
            messages={messages}
            loading={chatLoading}
            connectionState={connectionState}
            onSend={(content) => socketRef.current?.sendMessage(content) ?? Promise.resolve()}
          />
        )}
        {tab === 'room' && (
          <StudyRoomTab
            state={roomState}
            currentUserId={user?.id}
            connected={connectionState === 'connected'}
            onJoin={() => socketRef.current?.joinStudyRoom().catch(() => {})}
            onLeave={() => socketRef.current?.leaveStudyRoom().catch(() => {})}
            onSetStatus={(status) => socketRef.current?.setStudyStatus(status).catch(() => {})}
            onStartTimer={(minutes) => socketRef.current?.startRoomTimer(minutes).catch(() => {})}
          />
        )}
        {tab === 'members' && (
          <MembersTab
            members={group.members}
            currentUserId={user?.id}
            isOwner={isOwner}
            onRemove={async (userId) => {
              await studyGroupService.removeMember(group.studyGroupId, userId);
              setGroup((g) => (g ? { ...g, members: g.members.filter((m) => m.userId !== userId) } : g));
            }}
          />
        )}
        {tab === 'courses' && (
          <SharedCoursesTab
            groupId={group.studyGroupId}
            sharedCourses={group.sharedCourses}
            onChange={(sharedCourses) => setGroup((g) => (g ? { ...g, sharedCourses } : g))}
          />
        )}
        {tab === 'leaderboard' && <LeaderboardTab groupId={group.studyGroupId} />}
        {tab === 'battles' && <BattlesTab groupId={group.studyGroupId} />}
        {tab === 'assignments' && <AssignmentsTab groupId={group.studyGroupId} isOwner={isOwner} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },
  header: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    gap: Spacing.two,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  glassButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Overlay.glass,
    borderWidth: 1,
    borderColor: Overlay.glassBorder,
  },
  title: { ...Typography.screenTitle, color: Colors.white, flex: 1, textAlign: 'center' },
  pillRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Overlay.glass,
    borderWidth: 1,
    borderColor: Overlay.glassBorder,
  },
  pillText: { ...Typography.captionBold, color: Colors.white },
  tabRowWrap: { paddingVertical: Spacing.two },
  tabRow: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgCard,
    ...Shadows.card,
  },
  tabChipActive: { backgroundColor: Colors.primary, ...Shadows.primaryGlow },
  tabChipText: { ...Typography.captionBold, color: Colors.textSecondary },
  tabChipTextActive: { color: Colors.primaryForeground },
  tabContent: { flex: 1 },
});

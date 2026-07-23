import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BookOpen from 'lucide-react-native/icons/book-open';
import Coffee from 'lucide-react-native/icons/coffee';
import LogIn from 'lucide-react-native/icons/log-in';
import LogOut from 'lucide-react-native/icons/log-out';
import Timer from 'lucide-react-native/icons/timer';
import Users from 'lucide-react-native/icons/users';

import { Card } from '@/components/Card';
import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { StudyRoomState, StudyRoomStatus } from '@/services/groupChatSocket';

interface StudyRoomTabProps {
  state: StudyRoomState | null;
  currentUserId?: string;
  connected: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onSetStatus: (status: StudyRoomStatus) => void;
  onStartTimer: (minutes: number) => void;
}

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Live co-study room (ported from web's StudyRoomPanel): who from the group is
 * studying right now, their studying/break status, and a shared focus timer
 * anyone can start. All state arrives over the group hub's RoomState event.
 */
export const StudyRoomTab: React.FC<StudyRoomTabProps> = ({
  state, currentUserId, connected, onJoin, onLeave, onSetStatus, onStartTimer,
}) => {
  const members = state?.members ?? [];
  const me = members.find((m) => m.userId === currentUserId);
  const joined = !!me;

  // Tick every second while a shared timer runs. `now` starts at 0 (not
  // Date.now() — impure during render, the React Compiler rule that bit the
  // battle screens) and gets its first real value from a 0ms timeout.
  const [now, setNow] = useState(0);
  const timerEnds = state?.timerEndsAt ? new Date(state.timerEndsAt).getTime() : null;
  const timerPending = timerEnds !== null && now === 0;
  const timerRunning = timerEnds !== null && now !== 0 && timerEnds > now;
  useEffect(() => {
    if (!timerPending && !timerRunning) return;
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [timerPending, timerRunning]);

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Users size={15} color={Colors.teal} />
          <Text style={styles.headerText}>Live study room</Text>
          {joined ? (
            <Pressable onPress={onLeave} style={styles.leaveButton} disabled={!connected}>
              <LogOut size={12} color={Colors.textSecondary} />
              <Text style={styles.leaveButtonText}>Leave</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onJoin} style={[styles.joinButton, !connected && styles.disabled]} disabled={!connected}>
              <LogIn size={12} color={Colors.primaryForeground} />
              <Text style={styles.joinButtonText}>Join</Text>
            </Pressable>
          )}
        </View>

        {timerRunning ? (
          <View style={styles.timerBox}>
            <Timer size={18} color={Colors.teal} />
            <View style={styles.timerBody}>
              <Text style={styles.timerValue}>{formatRemaining(timerEnds! - now)}</Text>
              <Text style={styles.timerMeta} numberOfLines={1}>
                {state?.timerMinutes}-min focus · started by {state?.timerStartedBy}
              </Text>
            </View>
          </View>
        ) : joined ? (
          <View style={styles.timerStartRow}>
            <Text style={styles.mutedText}>Focus together:</Text>
            {[25, 50].map((m) => (
              <Pressable key={m} onPress={() => onStartTimer(m)} style={styles.timerOption}>
                <Text style={styles.timerOptionText}>{m} min</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {members.length === 0 ? (
          <Text style={styles.mutedText}>
            Nobody’s in the room right now — join and your groupmates will see you studying.
          </Text>
        ) : (
          <View style={styles.memberList}>
            {members.map((m) => (
              <View key={m.userId} style={styles.memberRow}>
                <View style={[styles.statusDot, { backgroundColor: m.status === 'studying' ? Colors.emerald : Colors.amber }]} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.name}{m.userId === currentUserId ? ' (you)' : ''}
                </Text>
                <Text style={styles.memberStatus}>{m.status === 'studying' ? 'studying' : 'on a break'}</Text>
              </View>
            ))}
          </View>
        )}

        {joined && (
          <View style={styles.statusToggleRow}>
            <Pressable
              onPress={() => onSetStatus('studying')}
              style={[styles.statusToggle, me?.status === 'studying' && styles.statusToggleStudying]}
            >
              <BookOpen size={13} color={me?.status === 'studying' ? Colors.emerald : Colors.textSecondary} />
              <Text style={[styles.statusToggleText, me?.status === 'studying' && { color: Colors.emerald }]}>Studying</Text>
            </Pressable>
            <Pressable
              onPress={() => onSetStatus('break')}
              style={[styles.statusToggle, me?.status === 'break' && styles.statusToggleBreak]}
            >
              <Coffee size={13} color={me?.status === 'break' ? Colors.amber : Colors.textSecondary} />
              <Text style={[styles.statusToggleText, me?.status === 'break' && { color: Colors.amber }]}>Break</Text>
            </Pressable>
          </View>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { padding: Spacing.three },
  card: { gap: Spacing.three },
  headerRow: { ...Layout.row, gap: Spacing.two },
  headerText: { ...Typography.bodyBold, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  joinButton: {
    ...Layout.row, gap: 4,
    backgroundColor: Colors.teal, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 7,
  },
  joinButtonText: { fontSize: 12, fontWeight: '700', color: Colors.primaryForeground },
  leaveButton: {
    ...Layout.row, gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 7,
  },
  leaveButtonText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  disabled: { opacity: 0.5 },
  timerBox: {
    ...Layout.row, gap: Spacing.two,
    backgroundColor: `${Colors.teal}${Alpha.tint}`, borderRadius: Radius.md, padding: Spacing.three,
  },
  timerBody: { flex: 1 },
  timerValue: { fontSize: 22, fontWeight: '800', color: Colors.teal, fontVariant: ['tabular-nums'] },
  timerMeta: { fontSize: 11, color: Colors.teal, marginTop: 2 },
  timerStartRow: { ...Layout.row, gap: Spacing.two },
  timerOption: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  timerOptionText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  mutedText: { ...Typography.caption, fontSize: 12, color: Colors.textSecondary },
  memberList: { gap: Spacing.two },
  memberRow: { ...Layout.row, gap: Spacing.two },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  memberName: { ...Typography.caption, color: Colors.textPrimary, flex: 1 },
  memberStatus: { fontSize: 11, color: Colors.textSecondary },
  statusToggleRow: {
    flexDirection: 'row', gap: Spacing.two, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.two,
  },
  statusToggle: {
    flex: 1, ...Layout.row, justifyContent: 'center', gap: 5,
    borderRadius: Radius.md, paddingVertical: 8,
  },
  statusToggleStudying: { backgroundColor: `${Colors.emerald}${Alpha.wash}` },
  statusToggleBreak: { backgroundColor: `${Colors.amber}${Alpha.wash}` },
  statusToggleText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
});

import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BellRing, Info } from 'lucide-react-native';

import { FilterChip } from '@/components/FilterChip';
import { InfoBanner } from '@/components/InfoBanner';
import { Colors, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  disableDailyReminder,
  getReminderSettings,
  isDevicePushRegistered,
  registerDeviceForPushAsync,
  scheduleDailyReminder,
  unregisterDeviceForPushAsync,
} from '@/services/pushService';

// Hour presets keep the picker simple — no wheel/date-picker dependency.
const REMINDER_TIMES: { label: string; hour: number }[] = [
  { label: '7:00', hour: 7 },
  { label: '9:00', hour: 9 },
  { label: '12:00', hour: 12 },
  { label: '18:00', hour: 18 },
  { label: '19:00', hour: 19 },
  { label: '21:00', hour: 21 },
];

const PUSH_FAILURE_MESSAGES: Record<string, string> = {
  'expo-go': 'Remote push isn’t available in Expo Go — use a development or App Store build.',
  'no-project-id': 'This build has no EAS project id, which Expo push tokens require.',
  'permission-denied': 'Notifications are disabled for this app. Enable them in system Settings first.',
  'token-failed': 'Couldn’t get a push token for this device (simulators can’t receive push).',
};

export default function NotificationsScreen() {
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(19);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getReminderSettings().then((s) => {
      setReminderEnabled(s.enabled);
      setReminderHour(s.hour);
    });
    isDevicePushRegistered().then(setPushEnabled);
  }, []);

  const toggleReminder = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const ok = await scheduleDailyReminder(reminderHour, 0);
        if (!ok) {
          Alert.alert('Notifications disabled', 'Enable notifications for this app in system Settings first.');
          return;
        }
        setReminderEnabled(true);
      } else {
        await disableDailyReminder();
        setReminderEnabled(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const changeReminderHour = async (hour: number) => {
    setReminderHour(hour);
    if (reminderEnabled) {
      await scheduleDailyReminder(hour, 0);
    }
  };

  const togglePush = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const result = await registerDeviceForPushAsync();
        if (!result.ok) {
          Alert.alert('Couldn’t enable push', PUSH_FAILURE_MESSAGES[result.reason] ?? 'Try again later.');
          return;
        }
        setPushEnabled(true);
      } else {
        await unregisterDeviceForPushAsync();
        setPushEnabled(false);
      }
    } catch {
      Alert.alert('Couldn’t update push registration', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Daily study reminder</Text>
            <Text style={styles.rowSubtitle}>A local notification at the same time every day.</Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={toggleReminder}
            disabled={busy}
            trackColor={{ true: Colors.primary }}
          />
        </View>
        {reminderEnabled && (
          <View style={styles.timeRow}>
            {REMINDER_TIMES.map(({ label, hour }) => (
              <FilterChip key={hour} label={label} active={reminderHour === hour} onPress={() => changeReminderHour(hour)} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Due-card reminders</Text>
            <Text style={styles.rowSubtitle}>
              Get a push when flashcards come due — at most one per day, sent by the server.
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={togglePush}
            disabled={busy}
            trackColor={{ true: Colors.primary }}
          />
        </View>
      </View>

      <InfoBanner
        icon={Info}
        text="Due-card reminders need a development or App Store build — Expo Go and simulators can schedule local reminders but can’t receive remote push."
      />

      <View style={styles.hintRow}>
        <BellRing size={14} color={Colors.textSecondary} />
        <Text style={styles.hintText}>Tapping a reminder opens the Study tab.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three,
    gap: Spacing.three, ...Shadows.card,
  },
  rowHeader: { ...Layout.row, gap: Spacing.three },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSubtitle: { ...Typography.caption, color: Colors.textSecondary },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  hintRow: { ...Layout.row, gap: 6, paddingHorizontal: 2 },
  hintText: { ...Typography.caption, color: Colors.textSecondary },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from '@/services/apiClient';

// The backend stores Expo push tokens in the same UserPushSubscriptions table as
// browser Web Push subscriptions; these placeholders fill the crypto-key columns
// that only browser subscriptions actually use.
const EXPO_KEY_PLACEHOLDER = 'expo';

const KEYS = {
  reminder: 'notifications.reminder',
  reminderNotificationId: 'notifications.reminderNotificationId',
  pushEndpoint: 'notifications.pushEndpoint',
} as const;

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export type PushRegistrationResult =
  | { ok: true }
  | { ok: false; reason: 'expo-go' | 'no-project-id' | 'permission-denied' | 'token-failed' };

/** Show foreground notifications as banners (parity with how the web app surfaces push). */
export function configureNotificationHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensurePermissionsAsync(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return requested.granted;
}

async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Study reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// ── Daily study reminder (local, works in Expo Go and on simulators) ──────────

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.reminder);
    if (raw) return JSON.parse(raw) as ReminderSettings;
  } catch { /* fall through to default */ }
  return { enabled: false, hour: 19, minute: 0 };
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  if (!(await ensurePermissionsAsync())) return false;
  await ensureAndroidChannelAsync();
  await cancelScheduledReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to study 📚',
      body: 'A few minutes of review keeps your streak alive.',
      data: { url: '/study' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.multiSet([
    [KEYS.reminderNotificationId, id],
    [KEYS.reminder, JSON.stringify({ enabled: true, hour, minute } satisfies ReminderSettings)],
  ]);
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  await cancelScheduledReminder();
  const settings = await getReminderSettings();
  await AsyncStorage.setItem(KEYS.reminder, JSON.stringify({ ...settings, enabled: false } satisfies ReminderSettings));
}

async function cancelScheduledReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(KEYS.reminderNotificationId);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
  } catch { /* nothing scheduled */ }
}

// ── Due-review remote push (needs a development/standalone build, not Expo Go) ─

export async function isDevicePushRegistered(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(KEYS.pushEndpoint));
}

export async function registerDeviceForPushAsync(): Promise<PushRegistrationResult> {
  // Expo Go has no push credentials — remote push requires a dev/standalone build.
  if (Constants.appOwnership === 'expo') return { ok: false, reason: 'expo-go' };

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { ok: false, reason: 'no-project-id' };

  if (!(await ensurePermissionsAsync())) return { ok: false, reason: 'permission-denied' };
  await ensureAndroidChannelAsync();

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return { ok: false, reason: 'token-failed' };
  }

  await apiClient.post('/api/notifications/push/subscribe', {
    endpoint: token,
    p256dh: EXPO_KEY_PLACEHOLDER,
    auth: EXPO_KEY_PLACEHOLDER,
  });
  await AsyncStorage.setItem(KEYS.pushEndpoint, token);
  return { ok: true };
}

export async function unregisterDeviceForPushAsync(): Promise<void> {
  const token = await AsyncStorage.getItem(KEYS.pushEndpoint);
  if (!token) return;
  try {
    await apiClient.post('/api/notifications/push/unsubscribe', { endpoint: token });
  } catch { /* backend row is pruned on next failed delivery anyway */ }
  await AsyncStorage.removeItem(KEYS.pushEndpoint);
}

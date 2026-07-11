import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Fire-and-forget haptic cues for study feedback (grading a card, answering a
// quiz question). Failures are swallowed — haptics are decoration, never flow.
const canVibrate = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  /** Light tick — selections, card flips. */
  tap(): void {
    if (!canVibrate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Positive buzz — correct answer, card rated Good/Easy. */
  success(): void {
    if (!canVibrate) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Cautionary buzz — imperfect quiz score. */
  warning(): void {
    if (!canVibrate) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  /** Negative buzz — wrong answer, card rated Again/Hard. */
  error(): void {
    if (!canVibrate) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};

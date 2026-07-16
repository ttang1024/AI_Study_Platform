import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';

import type { DashboardSummary } from '@/types';

// Must match `group.com.totoai.app.widget` in app.json's ios.entitlements and
// targets/widget/expo-target.config.js — the widget reads from this exact suite.
const APP_GROUP = 'group.com.totoai.app.widget';
const WIDGET_DATA_KEY = 'widgetData';

const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

/**
 * Pushes the latest due-card count and streak into the shared App Group so the
 * iOS home-screen widget can render them, then asks WidgetKit to redraw. Called
 * whenever the dashboard summary refreshes (see useDashboardData). No-op off iOS.
 */
export function syncWidgetData(summary: Pick<DashboardSummary, 'streak' | 'dueFlashcards'>): void {
  if (!storage) return;
  try {
    storage.set(WIDGET_DATA_KEY, {
      dueCount: summary.dueFlashcards,
      currentStreak: summary.streak.currentStreak,
      freezesAvailable: summary.streak.freezesAvailable ?? 0,
      updatedAt: new Date().toISOString(),
    });
    ExtensionStorage.reloadWidget();
  } catch {
    // Widget sync is best-effort — never let it break the dashboard.
  }
}

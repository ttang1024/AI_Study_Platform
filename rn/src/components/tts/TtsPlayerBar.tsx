import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import SkipBack from 'lucide-react-native/icons/skip-back';
import SkipForward from 'lucide-react-native/icons/skip-forward';
import Timer from 'lucide-react-native/icons/timer';
import Volume2 from 'lucide-react-native/icons/volume-2';
import X from 'lucide-react-native/icons/x';

import { Alpha, Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { SLEEP_OPTIONS, type TtsState } from '@/hooks/useTts';

interface TtsPlayerBarProps {
  state: TtsState;
  title: string;
  subtitle?: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  disableSkipBack?: boolean;
  disableSkipForward?: boolean;
  sleepTimeLeft?: string | null;
  hasSleepTimer?: boolean;
  onSetSleepTimer?: (minutes: number) => void;
  onCancelSleepTimer?: () => void;
  error?: string | null;
  onDismissError?: () => void;
}

// RN port of web/src/components/common/TtsPlayer.tsx. Floats above the tab
// bar (no createPortal equivalent needed — it's mounted at the app root in
// TtsContext.tsx, so it naturally layers over everything).
export const TtsPlayerBar: React.FC<TtsPlayerBarProps> = ({
  state,
  title,
  subtitle,
  onPlay,
  onPause,
  onStop,
  onSkipBack,
  onSkipForward,
  disableSkipBack,
  disableSkipForward,
  sleepTimeLeft,
  hasSleepTimer,
  onSetSleepTimer,
  onCancelSleepTimer,
  error,
  onDismissError,
}) => {
  const insets = useSafeAreaInsets();

  const openSleepMenu = () => {
    if (!onSetSleepTimer) return;
    Alert.alert('Sleep timer', 'Stop playback after…', [
      ...SLEEP_OPTIONS.map((o) => ({ text: o.label, onPress: () => onSetSleepTimer(o.minutes) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <View style={[styles.root, { bottom: insets.bottom + Spacing.three }]} pointerEvents="box-none">
      {!!error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={Colors.red} />
          <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
          {onDismissError && (
            <Pressable onPress={onDismissError} hitSlop={8}>
              <X size={14} color={Colors.red} />
            </Pressable>
          )}
        </View>
      )}

      {state !== 'idle' && (
        <View style={styles.bar}>
          <View style={styles.icon}>
            <Volume2 size={18} color={Colors.primary} />
          </View>

          <View style={styles.info}>
            {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>

          <View style={styles.controls}>
            {onSkipBack && (
              <Pressable style={styles.smallButton} onPress={onSkipBack} disabled={disableSkipBack} hitSlop={6}>
                <SkipBack size={16} color={disableSkipBack ? Colors.zinc300 : Colors.textSecondary} />
              </Pressable>
            )}
            {state === 'loading' ? (
              <View style={[styles.playButton, styles.playButtonLoading]}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : state === 'playing' ? (
              <Pressable style={styles.playButton} onPress={onPause}>
                <Pause size={16} color={Colors.primaryForeground} />
              </Pressable>
            ) : (
              <Pressable style={styles.playButton} onPress={onPlay}>
                <Play size={16} color={Colors.primaryForeground} />
              </Pressable>
            )}
            {onSkipForward && (
              <Pressable style={styles.smallButton} onPress={onSkipForward} disabled={disableSkipForward} hitSlop={6}>
                <SkipForward size={16} color={disableSkipForward ? Colors.zinc300 : Colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {onSetSleepTimer && (
            hasSleepTimer ? (
              <Pressable style={styles.sleepBadge} onPress={onCancelSleepTimer}>
                <Timer size={12} color={Colors.amber} />
                <Text style={styles.sleepBadgeText}>{sleepTimeLeft}</Text>
                <X size={11} color={Colors.amber} />
              </Pressable>
            ) : (
              <Pressable style={styles.smallButton} onPress={openSleepMenu} hitSlop={6}>
                <Timer size={16} color={Colors.textSecondary} />
              </Pressable>
            )
          )}

          <Pressable style={styles.closeButton} onPress={onStop} hitSlop={6}>
            <X size={15} color={Colors.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { position: 'absolute', left: Spacing.three, right: Spacing.three, gap: Spacing.two, zIndex: 50 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two,
    backgroundColor: `${Colors.red}${Alpha.wash}`, borderWidth: 1, borderColor: `${Colors.red}${Alpha.tint}`,
    borderRadius: Radius.lg, padding: Spacing.three,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.red },
  bar: {
    ...Layout.row, gap: Spacing.two,
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  icon: {
    width: 36, height: 36, borderRadius: Radius.md, ...Layout.center, backgroundColor: `${Colors.primary}${Alpha.tint}`,
  },
  info: { flex: 1, minWidth: 0 },
  subtitle: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  controls: { ...Layout.row, gap: 2 },
  smallButton: { padding: 6 },
  playButton: {
    width: 32, height: 32, borderRadius: Radius.md, ...Layout.center, backgroundColor: Colors.primary,
  },
  playButtonLoading: { backgroundColor: `${Colors.primary}22` },
  sleepBadge: {
    ...Layout.row, gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.md,
    backgroundColor: `${Colors.amber}${Alpha.wash}`, borderWidth: 1, borderColor: `${Colors.amber}${Alpha.tint}`,
  },
  sleepBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.amber },
  closeButton: { padding: 4 },
});

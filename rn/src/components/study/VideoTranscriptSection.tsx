import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Captions from 'lucide-react-native/icons/captions';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';

import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { videoService, type TranscriptSegment } from '@/services/videoService';

interface VideoTranscriptSectionProps {
  videoRecordId: string;
  sourceVideoId: string;
  sourceType?: string;
}

const fmtTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
};

/**
 * Captions for a saved video, captured automatically on mount. YouTube videos are
 * keyed by their source id; everything else resolves through the record id (the
 * backend falls back yt-dlp → Whisper and caches the result). Mirrors the web
 * VideoDetailPage transcript view, minus tap-to-seek.
 */
export const VideoTranscriptSection: React.FC<VideoTranscriptSectionProps> = ({
  videoRecordId,
  sourceVideoId,
  sourceType,
}) => {
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  // Uploaded videos are transcribed in the background; while that runs the API answers
  // TRANSCRIPT_PENDING and this re-checks on its own (bounded, ~10 minutes).
  const pendingPolls = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const fetchCaptions = () =>
      sourceType === 'youtube' && sourceVideoId
        ? videoService.getTranscript(sourceVideoId)
        : videoService.getVideoTranscript(videoRecordId);

    fetchCaptions()
      .then((segs) => {
        if (cancelled) return;
        setSegments(segs.length > 0 ? segs : null);
        setError(segs.length > 0 ? null : 'No captions available for this video.');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const data = (err as { response?: { data?: { message?: string; errorCode?: string } } })?.response?.data;
        const message = data?.message ?? 'No captions available for this video.';
        setSegments(null);
        setError(message);
        if (data?.errorCode === 'TRANSCRIPT_PENDING' && pendingPolls.current < 40) {
          pendingPolls.current += 1;
          retryTimer = setTimeout(() => setReloadNonce((n) => n + 1), 15_000);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [videoRecordId, sourceVideoId, sourceType, reloadNonce]);

  const refresh = () => {
    setLoading(true);
    setError(null);
    setSegments(null);
    setReloadNonce((n) => n + 1);
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.centerText}>Capturing captions…</Text>
      </View>
    );
  }

  if (!segments) {
    return (
      <EmptyState
        icon={Captions}
        title="Captions unavailable"
        subtitle={error ?? 'No captions available for this video.'}
        action={{ label: 'Try again', onPress: refresh }}
      />
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Transcript</Text>
        <Pressable style={styles.refreshBtn} onPress={refresh} accessibilityLabel="Refresh captions">
          <RotateCcw size={13} color={Colors.textSecondary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
      {segments.map((seg, i) => (
        <View key={`${seg.startSeconds}-${i}`} style={styles.segment}>
          <Text style={styles.timestamp}>{fmtTime(seg.startSeconds)}</Text>
          <Text style={styles.segmentText} selectable>
            {seg.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  centerBox: { ...Layout.center, paddingVertical: Spacing.six, gap: Spacing.two },
  centerText: { ...Typography.body, fontSize: 13, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two,
  },
  headerRow: { ...Layout.rowBetween },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.primary },
  refreshBtn: {
    ...Layout.row, gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: Colors.bgApp,
  },
  refreshText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  segment: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  timestamp: {
    fontSize: 11, fontWeight: '700', color: Colors.primary, fontVariant: ['tabular-nums'],
    minWidth: 44, paddingTop: 2,
  },
  segmentText: { ...Typography.body, flex: 1, fontSize: 14, lineHeight: 21, color: Colors.textPrimary },
});

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Share2 } from 'lucide-react-native';

import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { ShareSheet } from '@/components/ShareSheet';
import { TabChipRow } from '@/components/TabChipRow';
import { VideoPlayerStage } from '@/components/library/VideoPlayerStage';
import { VideoTabContent } from '@/components/library/VideoTabContent';
import { TABS } from '@/components/library/videoDetailMeta';
import { useVideoDetail } from '@/hooks/useVideoDetail';
import { quizService } from '@/services/quizService';
import { fetchVideoShareCards } from '@/services/shareService';

export default function VideoDetailScreen() {
  const v = useVideoDetail();
  const [showShare, setShowShare] = useState(false);

  if (v.loading) return <ActivityIndicator style={styles.center} color={Colors.primary} />;
  if (v.error || !v.video) return <Text style={styles.center}>Couldn&apos;t load this video.</Text>;

  const { video } = v;

  return (
    <View style={styles.root}>
      <VideoPlayerStage
        video={video}
        uploadedRef={v.uploadedRef}
        youtubeRef={v.youtubeRef}
        embedStartSeconds={v.embedStartSeconds}
        embedSeekNonce={v.embedSeekNonce}
      />

      <View style={styles.header}>
        <Text style={styles.title}>{video.title}</Text>
        <Pressable style={styles.shareButton} onPress={() => setShowShare(true)} accessibilityLabel="Share this video">
          <Share2 size={18} color={Colors.primary} />
        </Pressable>
      </View>

      <TabChipRow tabs={TABS} active={v.tab} onChange={v.setTab} />

      <VideoTabContent video={video} setVideo={v.setVideo} tab={v.tab} onTimelineSeek={v.seekTo} />

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        title={video.title}
        summary={video.summary}
        sourceType={video.sourceType}
        sourceUrl={video.sourceType === 'upload' ? `video/${video.id}` : video.videoUrl}
        fetchQuizzes={async () => {
          const qs = await quizService.getVideoQuiz(video.id);
          return qs.map((q) => ({
            question: q.question,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? '',
            difficulty: q.difficulty ?? 'medium',
          }));
        }}
        fetchFlashcards={() => fetchVideoShareCards(video.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, textAlign: 'center', marginTop: Spacing.five, color: Colors.textSecondary },
  header: { padding: Spacing.three, paddingBottom: Spacing.two, ...Layout.row, gap: Spacing.two },
  title: { ...Typography.screenTitle, color: Colors.textPrimary, flex: 1 },
  shareButton: {
    width: 36, height: 36, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgSidebar, ...Layout.center,
  },
});

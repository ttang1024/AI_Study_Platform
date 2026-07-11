import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Bot, FileText, HelpCircle, ListChecks, NotebookPen, Share2, Sparkles } from 'lucide-react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { videoService, VideoDetail } from '@/services/videoService';
import { buildEmbedSource, buildEmbedUrl } from '@/services/videoEmbed';
import { ShareSheet } from '@/components/ShareSheet';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { TabChipRow } from '@/components/TabChipRow';
import { ScopedChatPanel } from '@/components/chat/ScopedChatPanel';
import { VideoQuizSection } from '@/components/quiz/VideoQuizSection';
import { GenerateGlossarySection } from '@/components/study/GenerateGlossarySection';
import { GenerateSummarySection } from '@/components/study/GenerateSummarySection';
import { QuickNoteForm } from '@/components/study/QuickNoteForm';
import { WorkedProblemsSection } from '@/components/study/WorkedProblemsSection';
import { glossaryService } from '@/services/glossaryService';
import { noteService } from '@/services/noteService';
import { quizService } from '@/services/quizService';
import { fetchVideoShareCards } from '@/services/shareService';
import { workedProblemsService } from '@/services/workedProblemsService';
import { useStudyTimer } from '@/hooks/useStudyTimer';

type Tab = 'summary' | 'chat' | 'notes' | 'glossary' | 'quiz' | 'practice';

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'glossary', label: 'Glossary', icon: Sparkles },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'practice', label: 'Practice', icon: ListChecks },
];

function UploadedVideoPlayer({ videoRecordId, width, height }: { videoRecordId: string; width: number; height: number }) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  useEffect(() => {
    videoService.getUploadedVideoStreamUrl(videoRecordId).then(setStreamUrl);
  }, [videoRecordId]);

  const player = useVideoPlayer(streamUrl ? { uri: streamUrl } : null, (p) => {
    p.loop = false;
  });

  if (!streamUrl) return <ActivityIndicator color={Colors.primary} style={{ height }} />;

  return (
    <VideoView
      style={{ width, height }}
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

function YoutubeEmbeddedPlayer({ videoId, width, height }: { videoId: string; width: number; height: number }) {
  const [playing, setPlaying] = useState(true);

  const onChangeState = useCallback((state: string) => {
    if (state === 'ended') setPlaying(false);
  }, []);

  return (
    <YoutubePlayer
      height={height}
      width={width}
      videoId={videoId}
      play={playing}
      onChangeState={onChangeState}
    />
  );
}

export default function VideoDetailScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : 'summary');
  const [showShare, setShowShare] = useState(false);

  // Attribute watch/study time on this video to its course in analytics.
  useStudyTimer({ contextType: 'video', courseId: video?.courseId, contextId: id, enabled: !loading && !error });

  useEffect(() => {
    if (!id) return;
    videoService.getVideo(id)
      .then((v) => {
        setVideo(v);
        // Route param changes reuse this screen instance — clear a stale error
        // from a previous video so the successful load actually renders.
        setError(false);
        navigation.setOptions({ title: v.title });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, navigation]);

  const videoHeight = useMemo(() => (width * 9) / 16, [width]);

  if (loading) return <ActivityIndicator style={styles.center} color={Colors.primary} />;
  if (error || !video) return <Text style={styles.center}>Couldn&apos;t load this video.</Text>;

  const embedUrl = video.sourceType && video.sourceType !== 'upload' && video.sourceType !== 'youtube'
    ? buildEmbedUrl(video.sourceType, video.videoId, video.videoUrl)
    : null;

  return (
    <View style={styles.root}>
      <View style={[styles.player, { width, height: videoHeight }]}>
        {video.sourceType === 'upload' ? (
          <UploadedVideoPlayer videoRecordId={video.id} width={width} height={videoHeight} />
        ) : video.sourceType === 'youtube' ? (
          <YoutubeEmbeddedPlayer videoId={video.videoId} width={width} height={videoHeight} />
        ) : embedUrl ? (
          <WebView
            source={buildEmbedSource(embedUrl)}
            style={{ width, height: videoHeight }}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        ) : (
          <Text style={styles.center}>This video source isn&apos;t supported yet.</Text>
        )}
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>{video.title}</Text>
        <Pressable style={styles.shareButton} onPress={() => setShowShare(true)} accessibilityLabel="Share this video">
          <Share2 size={18} color={Colors.primary} />
        </Pressable>
      </View>

      <TabChipRow tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'chat' ? (
        <ScopedChatPanel sourceType="video" sourceId={video.id} title={video.title} />
      ) : (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
          {tab === 'summary' && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Summary</Text>
              {video.summary ? (
                <SummaryMarkdown value={video.summary} />
              ) : (
                <GenerateSummarySection
                  onGenerate={() => {
                    let text = '';
                    return videoService.streamSummary(video.id, (chunk) => { text += chunk; }).then(() => text);
                  }}
                  onGenerated={(summary) => setVideo((v) => (v ? { ...v, summary } : v))}
                />
              )}
            </View>
          )}

          {tab === 'notes' && (
            <QuickNoteForm onSubmit={(content) => noteService.create({ content, videoId: video.id }).then(() => {})} />
          )}

          {tab === 'glossary' && (
            <GenerateGlossarySection onGenerate={() => glossaryService.generateForVideo(video.id, video.videoUrl)} />
          )}

          {tab === 'quiz' && <VideoQuizSection videoId={video.id} videoUrl={video.videoUrl} />}

          {tab === 'practice' && (
            <WorkedProblemsSection
              getProblems={() => workedProblemsService.getForVideo(video.id)}
              generateProblems={(difficulty, count) => workedProblemsService.generateForVideo(video.id, difficulty, count)}
              submitAttempt={(problemId, answer) => workedProblemsService.submitAttempt(problemId, answer)}
            />
          )}
        </ScrollView>
      )}

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
  player: { backgroundColor: '#000' },
  header: { padding: Spacing.three, paddingBottom: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { ...Typography.screenTitle, color: Colors.textPrimary, flex: 1 },
  shareButton: {
    width: 36, height: 36, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgSidebar, alignItems: 'center', justifyContent: 'center',
  },
  tabContent: { flex: 1 },
  tabContentInner: { padding: Spacing.three, paddingTop: 0, gap: Spacing.three, paddingBottom: Spacing.six },
  summaryCard: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two,
  },
  summaryLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.primary },
});

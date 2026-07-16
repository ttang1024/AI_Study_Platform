import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { ScopedChatPanel } from '@/components/chat/ScopedChatPanel';
import { VideoQuizSection } from '@/components/quiz/VideoQuizSection';
import { FlashcardsSection } from '@/components/study/FlashcardsSection';
import { GenerateGlossarySection } from '@/components/study/GenerateGlossarySection';
import { GenerateSummarySection } from '@/components/study/GenerateSummarySection';
import { QuickNoteForm } from '@/components/study/QuickNoteForm';
import { VideoTranscriptSection } from '@/components/study/VideoTranscriptSection';
import { WorkedProblemsSection } from '@/components/study/WorkedProblemsSection';
import { glossaryService } from '@/services/glossaryService';
import { noteService } from '@/services/noteService';
import { videoService, type VideoDetail } from '@/services/videoService';
import { workedProblemsService } from '@/services/workedProblemsService';
import type { Tab } from '@/components/library/videoDetailMeta';

interface Props {
  video: VideoDetail;
  setVideo: React.Dispatch<React.SetStateAction<VideoDetail | null>>;
  tab: Tab;
  onTimelineSeek: (seconds: number) => void;
}

export function VideoTabContent({ video, setVideo, tab, onTimelineSeek }: Props) {
  if (tab === 'chat') {
    return <ScopedChatPanel sourceType="video" sourceId={video.id} title={video.title} />;
  }

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
      {tab === 'summary' && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Summary</Text>
          {video.summary ? (
            <SummaryMarkdown value={video.summary} onTimelineSeek={onTimelineSeek} />
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

      {tab === 'transcript' && (
        <VideoTranscriptSection
          videoRecordId={video.id}
          sourceVideoId={video.videoId}
          sourceType={video.sourceType}
        />
      )}

      {tab === 'notes' && (
        <QuickNoteForm onSubmit={(content) => noteService.create({ content, videoId: video.id }).then(() => {})} />
      )}

      {tab === 'glossary' && (
        <GenerateGlossarySection onGenerate={() => glossaryService.generateForVideo(video.id, video.videoUrl)} />
      )}

      {tab === 'cards' && (
        <FlashcardsSection
          deckId={video.id}
          getCards={() => videoService.getFlashcards(video.id)}
          generateCards={() => videoService.generateFlashcards(video.id, video.videoUrl)}
        />
      )}

      {tab === 'quiz' && <VideoQuizSection videoId={video.id} videoUrl={video.videoUrl} />}

      {tab === 'practice' && (
        <WorkedProblemsSection
          getProblems={() => workedProblemsService.getVideoProblems(video.id)}
          generateProblems={(difficulty, count) => workedProblemsService.generateVideoProblems(video.id, difficulty, count)}
          submitAttempt={(problemId, answer) => workedProblemsService.submitAttempt(problemId, answer)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabContent: { flex: 1 },
  tabContentInner: { padding: Spacing.three, paddingTop: 0, gap: Spacing.three, paddingBottom: Spacing.six },
  summaryCard: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two,
  },
  summaryLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.primary },
});

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { AlertCircle, Calendar, Check, Pause, Play, Share2, User, X } from 'lucide-react-native';

import { HtmlContent } from '@/components/HtmlContent';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { TabChipRow } from '@/components/TabChipRow';
import { Alpha, Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getShare, shareMediaUrl, type ShareableCard, type ShareableQuiz, type SharedContent } from '@/services/shareService';
import { buildMindMapHtml } from '@/utils/mindMapHtml';
import { xmindMarkToMarkdown } from '@/utils/xmindMarkdown';
import { FileText, Brain, NotebookPen, Layers, SquareLibrary, HelpCircle } from 'lucide-react-native';

type Tab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'glossary' | 'quiz';

interface ChatMessage { role: 'user' | 'model'; content: string }

/** Chat shares store the transcript as JSON inside notesHtml (see web SharedChatTranscript). */
const parseChatTranscript = (value: string): ChatMessage[] | null => {
  try {
    const parsed = JSON.parse(value) as { type?: string; messages?: { role?: string; content?: unknown }[] };
    if (parsed.type !== 'chat-transcript' || !Array.isArray(parsed.messages)) return null;
    const messages = parsed.messages
      .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.content === 'string')
      .map((m) => ({ role: m.role as 'user' | 'model', content: m.content as string }));
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
};

const parseYouTubeId = (url: string): string | null => {
  for (const p of [/[?&]v=([^&]+)/, /youtu\.be\/([^?&/]+)/, /youtube\.com\/shorts\/([^?&/]+)/, /youtube\.com\/embed\/([^?&/]+)/]) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const SOURCE_BADGES: Record<string, string> = {
  chat: 'AI Chat',
  youtube: 'YouTube Video',
  bilibili: 'Bilibili Video',
  upload: 'Uploaded Video',
  audio: 'Audio',
  podcast: 'Podcast',
  article: 'Article',
  document: 'Document',
};

function SharedAudioPlayer({ url }: { url: string }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  return (
    <View style={styles.audioBar}>
      <Pressable style={styles.audioButton} onPress={() => (status.playing ? player.pause() : player.play())}>
        {status.playing ? <Pause size={20} color={Colors.primaryForeground} /> : <Play size={20} color={Colors.primaryForeground} />}
      </Pressable>
      <Text style={styles.audioLabel}>{status.playing ? 'Playing…' : 'Tap to play'}</Text>
    </View>
  );
}

function SharedUploadedVideo({ url, width }: { url: string; width: number }) {
  const player = useVideoPlayer({ uri: url }, (p) => { p.loop = false; });
  return <VideoView style={{ width, height: (width * 9) / 16 }} player={player} nativeControls />;
}

export default function SharedContentScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { width } = useWindowDimensions();
  const [content, setContent] = useState<SharedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    if (!token) { setError('Invalid share link.'); return; }
    getShare(token)
      .then((data) => {
        setContent(data);
        if (data.summary) setTab('summary');
        else if (data.mindMapText) setTab('mindmap');
        else if (data.notesHtml) setTab('notes');
        else if (data.flashcards?.length) setTab('flashcards');
        else if (data.glossary?.length) setTab('glossary');
        else if (data.quizzes?.length) setTab('quiz');
      })
      .catch((e: { response?: { status?: number } }) => {
        setError(e?.response?.status === 410
          ? 'This share link has expired.'
          : 'This shared content could not be found or has expired.');
      });
  }, [token]);

  const mindMapHtml = useMemo(
    () => (content?.mindMapText ? buildMindMapHtml(xmindMarkToMarkdown(content.mindMapText)) : null),
    [content?.mindMapText],
  );

  if (error) {
    return (
      <View style={styles.center}>
        <AlertCircle size={32} color={Colors.red} />
        <Text style={styles.errorTitle}>Content not found</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!content) {
    return <ActivityIndicator style={styles.center} color={Colors.primary} />;
  }

  // Mirror web's normalization: legacy shares stored uploads/bilibili under "youtube".
  const sourceType = content.sourceType === 'youtube' && content.sourceUrl?.includes('bilibili.com')
    ? 'bilibili'
    : content.sourceType === 'youtube' && content.sourceUrl?.startsWith('video/')
      ? 'upload'
      : content.sourceType ?? null;

  const tabs = ([
    { id: 'summary' as Tab, label: 'Summary', icon: FileText, available: !!content.summary },
    { id: 'mindmap' as Tab, label: 'Mind Map', icon: Brain, available: !!content.mindMapText },
    { id: 'notes' as Tab, label: sourceType === 'chat' ? 'Conversation' : 'Notes', icon: NotebookPen, available: !!content.notesHtml },
    { id: 'flashcards' as Tab, label: 'Flashcards', icon: Layers, available: !!content.flashcards?.length },
    { id: 'glossary' as Tab, label: 'Glossary', icon: SquareLibrary, available: !!content.glossary?.length },
    { id: 'quiz' as Tab, label: 'Quiz', icon: HelpCircle, available: !!content.quizzes?.length },
  ]).filter((t) => t.available);

  const createdAt = new Date(content.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const youTubeId = sourceType === 'youtube' && content.sourceUrl ? parseYouTubeId(content.sourceUrl) : null;
  const chatMessages = sourceType === 'chat' && content.notesHtml ? parseChatTranscript(content.notesHtml) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Share2 size={11} color={Colors.primary} />
            <Text style={styles.badgeText}>{sourceType === 'chat' ? 'Shared Conversation' : 'Shared Study Content'}</Text>
          </View>
          {!!sourceType && !!SOURCE_BADGES[sourceType] && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{SOURCE_BADGES[sourceType]}</Text>
            </View>
          )}
        </View>
        <Text style={styles.title}>{content.title}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <User size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{content.ownerName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Calendar size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{createdAt}</Text>
          </View>
          {!!content.expiresAt && (
            <Text style={styles.expiryText}>Expires {new Date(content.expiresAt).toLocaleDateString()}</Text>
          )}
        </View>
      </View>

      {/* Media */}
      {(sourceType === 'audio' || sourceType === 'podcast') && (
        <SharedAudioPlayer url={shareMediaUrl(content.token, 'audio')} />
      )}
      {sourceType === 'upload' && (
        <View style={styles.videoBox}>
          <SharedUploadedVideo url={shareMediaUrl(content.token, 'video')} width={width - Spacing.three * 2} />
        </View>
      )}
      {!!youTubeId && (
        <View style={styles.videoBox}>
          <YoutubePlayer height={((width - Spacing.three * 2) * 9) / 16} width={width - Spacing.three * 2} videoId={youTubeId} />
        </View>
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <TabChipRow tabs={tabs} active={tab ?? tabs[0].id} onChange={(next: Tab) => setTab(next)} />
      )}

      {tab === 'summary' && !!content.summary && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <SummaryMarkdown value={content.summary} />
        </View>
      )}

      {tab === 'mindmap' && !!mindMapHtml && (
        <View style={styles.mindMapBox}>
          <WebView source={{ html: mindMapHtml }} style={styles.mindMapWebView} originWhitelist={['*']} bounces={false} />
        </View>
      )}

      {tab === 'notes' && !!content.notesHtml && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>{sourceType === 'chat' ? 'Conversation' : 'Notes'}</Text>
          {chatMessages ? (
            <View style={styles.chatList}>
              {chatMessages.map((m, i) => (
                <View key={i} style={[styles.chatBubble, m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleModel]}>
                  <Text style={[styles.chatText, m.role === 'user' && styles.chatTextUser]}>{m.content}</Text>
                </View>
              ))}
            </View>
          ) : (
            <HtmlContent html={content.notesHtml} />
          )}
        </View>
      )}

      {tab === 'flashcards' && !!content.flashcards?.length && (
        <SharedFlashcards cards={content.flashcards} />
      )}

      {tab === 'glossary' && !!content.glossary?.length && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Glossary</Text>
          {content.glossary.map((g, i) => (
            <View key={i} style={styles.glossaryRow}>
              <Text style={styles.glossaryTerm}>{g.term}</Text>
              <Text style={styles.glossaryDef}>{g.definition}</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'quiz' && !!content.quizzes?.length && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Quiz</Text>
          {content.quizzes.map((q, i) => (
            <SharedQuizQuestion key={i} index={i} question={q} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** Read-only flip-through deck (shared cards have no SRS state to rate). */
const SharedFlashcards: React.FC<{ cards: ShareableCard[] }> = ({ cards }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const go = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + cards.length) % cards.length);
  };
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionLabel}>Flashcards · {index + 1} / {cards.length}</Text>
      <Pressable style={styles.flashcard} onPress={() => setFlipped((f) => !f)}>
        <Text style={styles.flashcardLabel}>{flipped ? 'Answer' : 'Question'}</Text>
        <Text style={styles.flashcardText}>{flipped ? card.back : card.front}</Text>
        {!flipped && <Text style={styles.flashcardHint}>Tap to reveal</Text>}
      </Pressable>
      <View style={styles.deckNav}>
        <Pressable style={styles.deckNavButton} onPress={() => go(-1)}>
          <Text style={styles.deckNavText}>‹ Previous</Text>
        </Pressable>
        <Pressable style={styles.deckNavButton} onPress={() => go(1)}>
          <Text style={styles.deckNavText}>Next ›</Text>
        </Pressable>
      </View>
    </View>
  );
};

/** Tap an option to check it — green/red feedback plus the explanation. */
const SharedQuizQuestion: React.FC<{ index: number; question: ShareableQuiz }> = ({ index, question }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const isCorrect = (option: string) =>
    option === question.correctAnswer
    || option.startsWith(`${question.correctAnswer}.`)
    || question.correctAnswer.startsWith(option[0] ?? '');
  return (
    <View style={styles.quizItem}>
      <Text style={styles.quizQuestion}>{index + 1}. {question.question}</Text>
      {(question.options ?? []).map((option) => {
        const chosen = picked === option;
        const showCorrect = picked !== null && isCorrect(option);
        const showWrong = chosen && !isCorrect(option);
        return (
          <Pressable
            key={option}
            style={[styles.quizOption, showCorrect && styles.quizOptionCorrect, showWrong && styles.quizOptionWrong]}
            onPress={() => setPicked(option)}
            disabled={picked !== null}
          >
            <Text style={styles.quizOptionText}>{option}</Text>
            {showCorrect && <Check size={14} color={Colors.emerald} />}
            {showWrong && <X size={14} color={Colors.red} />}
          </Pressable>
        );
      })}
      {picked !== null && !!question.explanation && (
        <Text style={styles.quizExplanation}>{question.explanation}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp, gap: Spacing.two, padding: Spacing.five },
  errorTitle: { ...Typography.heading, color: Colors.textPrimary },
  errorText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  headerCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, ...Shadows.card,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${Colors.primary}${Alpha.tint}`, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { ...Typography.captionBold, color: Colors.primary, fontSize: 11 },
  title: { ...Typography.screenTitle, color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.caption, color: Colors.textSecondary },
  expiryText: { ...Typography.caption, color: Colors.amber },
  audioBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three, ...Shadows.card,
  },
  audioButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  audioLabel: { ...Typography.bodyBold, color: Colors.textPrimary },
  videoBox: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  sectionCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, ...Shadows.card,
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.primary },
  mindMapBox: { height: 420, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bgCard, ...Shadows.card },
  mindMapWebView: { flex: 1, backgroundColor: Colors.bgCard },
  chatList: { gap: Spacing.two },
  chatBubble: { borderRadius: Radius.lg, padding: Spacing.two, maxWidth: '88%' },
  chatBubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  chatBubbleModel: { alignSelf: 'flex-start', backgroundColor: Colors.zinc200 },
  chatText: { ...Typography.body, color: Colors.textPrimary },
  chatTextUser: { color: Colors.primaryForeground },
  flashcard: {
    minHeight: 200, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.three, gap: Spacing.two,
    backgroundColor: Colors.bgSidebar,
  },
  flashcardLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  flashcardText: { ...Typography.bodyBold, color: Colors.textPrimary, textAlign: 'center' },
  flashcardHint: { ...Typography.caption, color: Colors.textSecondary },
  deckNav: { flexDirection: 'row', gap: Spacing.two },
  deckNavButton: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSidebar,
  },
  deckNavText: { ...Typography.captionBold, color: Colors.textPrimary },
  glossaryRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  glossaryTerm: { ...Typography.bodyBold, color: Colors.textPrimary },
  glossaryDef: { ...Typography.caption, color: Colors.textSecondary },
  quizItem: { gap: Spacing.one, paddingBottom: Spacing.two },
  quizQuestion: { ...Typography.bodyBold, color: Colors.textPrimary },
  quizOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: 10, backgroundColor: Colors.bgSidebar,
  },
  quizOptionCorrect: { borderColor: Colors.emerald, backgroundColor: `${Colors.emerald}${Alpha.tint}` },
  quizOptionWrong: { borderColor: Colors.red, backgroundColor: `${Colors.red}${Alpha.tint}` },
  quizOptionText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  quizExplanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
});

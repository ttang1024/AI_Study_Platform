import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { BookOpen, Bot, Brain, Eye, EyeOff, FileImage, FileText, Headphones, HelpCircle, Highlighter, ListChecks, NotebookPen, Pause, Play, Presentation, Share2, Sparkles } from 'lucide-react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { documentService } from '@/services/documentService';
import { glossaryService } from '@/services/glossaryService';
import { noteService } from '@/services/noteService';
import { AnnotatedPdfViewer } from '@/components/AnnotatedPdfViewer';
import { ShareSheet } from '@/components/ShareSheet';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { TabChipRow } from '@/components/TabChipRow';
import { ScopedChatPanel } from '@/components/chat/ScopedChatPanel';
import { DocumentQuizSection } from '@/components/quiz/DocumentQuizSection';
import { GenerateGlossarySection } from '@/components/study/GenerateGlossarySection';
import { GenerateSummarySection } from '@/components/study/GenerateSummarySection';
import { MindMapView } from '@/components/study/MindMapView';
import { QuickNoteForm } from '@/components/study/QuickNoteForm';
import { WorkedProblemsSection } from '@/components/study/WorkedProblemsSection';
import { workedProblemsService } from '@/services/workedProblemsService';
import { quizService } from '@/services/quizService';
import { fetchDocumentShareCards } from '@/services/shareService';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { normalizeSummaryText } from '@/utils/summary';
import type { Document } from '@/types';

type Tab = 'summary' | 'chat' | 'mindmap' | 'highlights' | 'notes' | 'glossary' | 'quiz' | 'practice';

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'mindmap', label: 'Mind Map', icon: Brain },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'glossary', label: 'Glossary', icon: Sparkles },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'practice', label: 'Practice', icon: ListChecks },
];

// Highlighting needs a rendered PDF page — text-based docs don't get the tab.
const HIGHLIGHTS_TAB = { id: 'highlights' as Tab, label: 'Highlights', icon: Highlighter };

const TYPE_ICON: Record<Document['type'], typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  audio: Headphones,
  podcast: Headphones,
  image: FileImage,
  ppt: Presentation,
  epub: BookOpen,
};

const formatUploadDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function FilePreview({ url, type }: { url: string; type: Document['type'] }) {
  const { width } = useWindowDimensions();
  // PDFs render natively in both WKWebView (iOS) and the Chromium-based
  // Android WebView, so load them directly. Only docx needs an external
  // renderer, and even that only works reliably against a publicly
  // reachable URL — Google's gview endpoint often fails against
  // short-lived, signed download URLs (returns "No preview available").
  const source = type === 'docx'
    ? { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}` }
    : { uri: url };

  return (
    <View style={[styles.previewBox, { height: width * 1.3 }]}>
      <WebView
        source={source}
        style={styles.previewWebView}
        originWhitelist={['*']}
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} color={Colors.primary} />}
      />
    </View>
  );
}

function AudioPlayer({ url }: { url: string }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);

  return (
    <View style={styles.audioBar}>
      <Pressable
        style={styles.audioButton}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        {status.playing ? <Pause size={20} color={Colors.primaryForeground} /> : <Play size={20} color={Colors.primaryForeground} />}
      </Pressable>
      <Text style={styles.audioLabel}>{status.playing ? 'Playing…' : 'Tap to play'}</Text>
    </View>
  );
}

export default function DocumentDetailScreen() {
  const { id, courseId, tab: initialTab } = useLocalSearchParams<{ id: string; courseId: string; tab?: string }>();
  const navigation = useNavigation();
  const [doc, setDoc] = useState<Document | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) || initialTab === HIGHLIGHTS_TAB.id ? (initialTab as Tab) : 'summary',
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Attribute reading/quizzing time on this document to its course in analytics.
  useStudyTimer({ contextType: 'document', courseId, contextId: id, enabled: !loading && !error });

  useEffect(() => {
    if (!id || !courseId) return;
    documentService.getDocument(courseId, id)
      .then((d) => {
        setDoc(d);
        // Route param changes reuse this screen instance — clear a stale error
        // from a previous document so the successful load actually renders.
        setError(false);
        navigation.setOptions({ title: d.name });
        documentService.getDownloadUrl(courseId, id).then(setDownloadUrl).catch(() => {});
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, courseId, navigation]);

  if (loading) return <ActivityIndicator style={styles.center} color={Colors.primary} />;
  if (error || !doc) return <Text style={styles.center}>Couldn&apos;t load this document.</Text>;

  const isAudio = doc.type === 'audio' || doc.type === 'podcast';
  const summaryText = normalizeSummaryText(doc.summary);
  const TypeIcon = TYPE_ICON[doc.type] ?? FileText;
  const uploadDate = formatUploadDate(doc.uploadDate);
  const isPdf = doc.type === 'pdf';
  const tabs = isPdf ? [...TABS.slice(0, 3), HIGHLIGHTS_TAB, ...TABS.slice(3)] : TABS;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.typeIcon}>
            <TypeIcon size={20} color={Colors.primary} />
          </View>
          <View style={styles.titleTextGroup}>
            <Text style={styles.title} numberOfLines={2}>{doc.name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{doc.type}</Text>
              </View>
              {!!doc.courseName && <Text style={styles.metaText} numberOfLines={1}>{doc.courseName}</Text>}
              {!!uploadDate && <Text style={styles.metaText}>· {uploadDate}</Text>}
            </View>
          </View>
          <Pressable style={styles.shareButton} onPress={() => setShowShare(true)} accessibilityLabel="Share this document">
            <Share2 size={18} color={Colors.primary} />
          </Pressable>
        </View>

        {isAudio && downloadUrl && <AudioPlayer url={downloadUrl} />}

        {!isAudio && (
          <Pressable
            style={styles.openButton}
            disabled={!downloadUrl}
            onPress={() => setShowPreview((v) => !v)}
          >
            {showPreview ? (
              <EyeOff size={16} color={Colors.primary} />
            ) : (
              <Eye size={16} color={Colors.primary} />
            )}
            <Text style={styles.openButtonText}>{showPreview ? 'Hide preview' : 'Preview file'}</Text>
          </Pressable>
        )}

        {!isAudio && showPreview && downloadUrl && <FilePreview url={downloadUrl} type={doc.type} />}
      </View>

      <TabChipRow tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'chat' ? (
        <ScopedChatPanel sourceType="document" sourceId={id} courseId={courseId} title={doc.name} />
      ) : (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
          {tab === 'summary' && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Summary</Text>
              {summaryText ? (
                <SummaryMarkdown value={summaryText} />
              ) : (
                <GenerateSummarySection
                  onGenerate={() => documentService.generateSummary(courseId, id).then((d) => d.summary ?? '')}
                  onGenerated={(text) => setDoc((d) => (d ? { ...d, summary: text } : d))}
                />
              )}
            </View>
          )}

          {tab === 'mindmap' && (
            <MindMapView document={doc} courseId={courseId} onDocumentUpdate={setDoc} />
          )}

          {tab === 'highlights' && (
            downloadUrl
              ? <AnnotatedPdfViewer documentId={id} pdfUrl={downloadUrl} />
              : <ActivityIndicator color={Colors.primary} />
          )}

          {tab === 'notes' && (
            <QuickNoteForm onSubmit={(content) => noteService.createForDocument(courseId, id, content).then(() => {})} />
          )}

          {tab === 'glossary' && (
            <GenerateGlossarySection onGenerate={() => glossaryService.generateForDocument(courseId, id)} />
          )}

          {tab === 'quiz' && <DocumentQuizSection courseId={courseId} documentId={id} />}

          {tab === 'practice' && (
            <WorkedProblemsSection
              getProblems={() => workedProblemsService.getForDocument(id)}
              generateProblems={(difficulty, count) => workedProblemsService.generateForDocument(id, difficulty, count)}
              submitAttempt={(problemId, answer) => workedProblemsService.submitAttempt(problemId, answer)}
            />
          )}
        </ScrollView>
      )}

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        title={doc.name}
        summary={summaryText}
        mindMapText={doc.mindMapText}
        sourceType="document"
        sourceUrl={`${courseId}/${id}`}
        fetchQuizzes={async () => {
          const qs = await quizService.getDocumentQuiz(courseId, id);
          return qs.map((q) => ({
            question: q.question,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? '',
            difficulty: q.difficulty ?? 'medium',
          }));
        }}
        fetchFlashcards={() => fetchDocumentShareCards(courseId, id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, textAlign: 'center', marginTop: Spacing.five, color: Colors.textSecondary },
  header: {
    padding: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  titleRow: { flexDirection: 'row', gap: Spacing.two },
  typeIcon: {
    width: 40, height: 40, borderRadius: Radius.md, backgroundColor: `${Colors.primary}1a`,
    alignItems: 'center', justifyContent: 'center',
  },
  titleTextGroup: { flex: 1, gap: 4 },
  shareButton: {
    width: 36, height: 36, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgSidebar, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...Typography.screenTitle, color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeBadge: {
    backgroundColor: `${Colors.primary}1a`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  audioBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  audioButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  audioLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  openButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, height: 44, backgroundColor: Colors.bgSidebar,
  },
  openButtonText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  previewBox: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    overflow: 'hidden', backgroundColor: Colors.bgSidebar,
  },
  previewWebView: { flex: 1, backgroundColor: 'transparent' },
  tabContent: { flex: 1 },
  tabContentInner: { padding: Spacing.three, paddingTop: 0, gap: Spacing.three, paddingBottom: Spacing.six },
  summaryCard: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two,
  },
  summaryLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.primary },
});

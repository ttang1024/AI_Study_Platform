import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { AnnotatedPdfViewer } from '@/components/AnnotatedPdfViewer';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { ScopedChatPanel } from '@/components/chat/ScopedChatPanel';
import { DocumentQuizSection } from '@/components/quiz/DocumentQuizSection';
import { FlashcardsSection } from '@/components/study/FlashcardsSection';
import { GenerateGlossarySection } from '@/components/study/GenerateGlossarySection';
import { GenerateSummarySection } from '@/components/study/GenerateSummarySection';
import { MindMapView } from '@/components/study/MindMapView';
import { QuickNoteForm } from '@/components/study/QuickNoteForm';
import { WorkedProblemsSection } from '@/components/study/WorkedProblemsSection';
import { documentService } from '@/services/documentService';
import { glossaryService } from '@/services/glossaryService';
import { noteService } from '@/services/noteService';
import { workedProblemsService } from '@/services/workedProblemsService';
import type { Tab } from '@/components/library/documentDetailMeta';
import type { Document } from '@/types';

interface Props {
  doc: Document;
  setDoc: React.Dispatch<React.SetStateAction<Document | null>>;
  courseId: string;
  id: string;
  downloadUrl: string | null;
  tab: Tab;
  summaryText: string | null;
}

export function DocumentTabContent({ doc, setDoc, courseId, id, downloadUrl, tab, summaryText }: Props) {
  if (tab === 'chat') {
    return <ScopedChatPanel sourceType="document" sourceId={id} courseId={courseId} title={doc.name} />;
  }

  return (
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

      {tab === 'cards' && (
        <FlashcardsSection
          deckId={id}
          getCards={() => documentService.getFlashcards(courseId, id)}
          generateCards={() => documentService.generateFlashcards(courseId, id)}
        />
      )}

      {tab === 'quiz' && <DocumentQuizSection courseId={courseId} documentId={id} />}

      {tab === 'practice' && (
        <WorkedProblemsSection
          getProblems={() => workedProblemsService.getProblems(id)}
          generateProblems={(difficulty, count) => workedProblemsService.generateProblems(id, difficulty, count)}
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

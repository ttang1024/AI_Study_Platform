import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { ShareSheet } from '@/components/ShareSheet';
import { TabChipRow } from '@/components/TabChipRow';
import { DocumentDetailHeader } from '@/components/library/DocumentDetailHeader';
import { DocumentTabContent } from '@/components/library/DocumentTabContent';
import { resolveTabs } from '@/components/library/documentDetailMeta';
import { useDocumentDetail } from '@/hooks/useDocumentDetail';
import { quizService } from '@/services/quizService';
import { fetchDocumentShareCards } from '@/services/shareService';
import { normalizeSummaryText } from '@/utils/summary';

export default function DocumentDetailScreen() {
  const { id, courseId, doc, setDoc, downloadUrl, loading, error, tab, setTab } = useDocumentDetail();
  const [showPreview, setShowPreview] = useState(false);
  const [showShare, setShowShare] = useState(false);

  if (loading) return <ActivityIndicator style={styles.center} color={Colors.primary} />;
  if (error || !doc) return <Text style={styles.center}>Couldn&apos;t load this document.</Text>;

  const summaryText = normalizeSummaryText(doc.summary);

  return (
    <View style={styles.root}>
      <DocumentDetailHeader
        doc={doc}
        downloadUrl={downloadUrl}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((v) => !v)}
        onOpenShare={() => setShowShare(true)}
      />

      <TabChipRow tabs={resolveTabs(doc.type === 'pdf')} active={tab} onChange={setTab} />

      <DocumentTabContent
        doc={doc}
        setDoc={setDoc}
        courseId={courseId}
        id={id}
        downloadUrl={downloadUrl}
        tab={tab}
        summaryText={summaryText}
      />

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
});

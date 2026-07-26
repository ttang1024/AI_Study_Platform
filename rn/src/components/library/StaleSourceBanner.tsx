import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { documentService } from '@/services/documentService';
import type { DocumentStaleness } from '@core/services/documentService';

interface Props {
  documentId: string;
  /** Called after artifacts are cleared, so the screen can refetch what it shows. */
  onRegenerated?: () => void;
}

/**
 * Shown when the document's file has been replaced since its study material was generated.
 *
 * Deliberately a prompt rather than an automatic rebuild: regenerating discards the existing cards
 * and with them their FSRS scheduling. That is the learner's call.
 */
export const StaleSourceBanner: React.FC<Props> = ({ documentId, onRegenerated }) => {
  const [staleness, setStaleness] = useState<DocumentStaleness | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await documentService.getStaleness(documentId);
      setStaleness(res.data?.data ?? null);
    } catch {
      setStaleness(null);
    }
  }, [documentId]);

  // Wrapped so every setState lands in an async continuation rather than the effect body. Each
  // `load` begins with an await, so nothing was setting state synchronously anyway — this just
  // makes that visible to the compiler's effect analysis.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  if (!staleness?.hasStaleArtifacts) return null;

  const parts: string[] = [];
  if (staleness.staleFlashcards > 0) parts.push(`${staleness.staleFlashcards} flashcards`);
  if (staleness.staleQuizzes > 0) parts.push(`${staleness.staleQuizzes} quiz questions`);
  if (staleness.staleGlossaryTerms > 0) parts.push(`${staleness.staleGlossaryTerms} glossary terms`);
  if (staleness.summaryStale) parts.push('the summary');
  if (staleness.mindMapStale) parts.push('the mind map');

  const rebuild = async () => {
    setBusy(true);
    try {
      await documentService.regenerateStale(documentId);
      await load();
      onRegenerated?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.banner}>
      <AlertTriangle size={18} color={Colors.amber} />
      <View style={styles.body}>
        <Text style={styles.title}>
          This document&apos;s file was replaced
          {staleness.sourceChangedAt
            ? ` on ${new Date(staleness.sourceChangedAt).toLocaleDateString()}`
            : ''}
          .
        </Text>
        <Text style={styles.detail}>
          {parts.join(', ')} came from the previous version. Rebuilding discards them, including any
          review history on those cards.
        </Text>
      </View>
      <Pressable onPress={rebuild} disabled={busy} style={styles.button}>
        {busy ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <RefreshCw size={14} color={Colors.white} />
        )}
        <Text style={styles.buttonText}>Rebuild</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    margin: Spacing.three,
    marginBottom: 0,
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.amber,
    backgroundColor: `${Colors.amber}18`,
  },
  body: { flex: 1, gap: 2 },
  title: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
  detail: { ...Typography.caption, color: Colors.textSecondary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.amber,
  },
  buttonText: { ...Typography.captionBold, color: Colors.white },
});

export default StaleSourceBanner;

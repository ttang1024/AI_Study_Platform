import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Copy from 'lucide-react-native/icons/copy';
import Share2 from 'lucide-react-native/icons/share-2';
import X from 'lucide-react-native/icons/x';

import { Button } from '@/components/Button';
import { Alpha, Colors, Layout, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  createShare, type ShareableCard, type ShareableQuiz,
} from '@/services/shareService';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  summary?: string | null;
  mindMapText?: string | null;
  /** Lazily resolved so quizzes/cards are only fetched when actually shared. */
  fetchQuizzes?: () => Promise<ShareableQuiz[]>;
  fetchFlashcards?: () => Promise<ShareableCard[]>;
  sourceType?: string | null;
  sourceUrl?: string | null;
}

type ContentKey = 'summary' | 'mindMap' | 'flashcards' | 'quizzes';

/**
 * Mobile counterpart of web's ShareModal: pick which generated content to
 * include, mint a public /share/{token} link, then copy it or hand it to the
 * native share sheet. (Web's "Save as Image" mode has no RN equivalent here.)
 */
export const ShareSheet: React.FC<ShareSheetProps> = ({
  visible, onClose, title, summary, mindMapText, fetchQuizzes, fetchFlashcards, sourceType, sourceUrl,
}) => {
  const [selected, setSelected] = useState<Set<ContentKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = ([
    { key: 'summary', label: 'Summary', available: !!summary },
    { key: 'mindMap', label: 'Mind Map', available: !!mindMapText },
    { key: 'flashcards', label: 'Flashcards', available: !!fetchFlashcards },
    { key: 'quizzes', label: 'Quiz', available: !!fetchQuizzes },
  ] satisfies { key: ContentKey; label: string; available: boolean }[]).filter((i) => i.available);

  const toggle = (key: ContentKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const reset = () => {
    setSelected(new Set());
    setBusy(false);
    setShareUrl('');
    setCopied(false);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      // Empty lists become null so the shared page doesn't render empty sections.
      const quizzes = selected.has('quizzes') && fetchQuizzes ? await fetchQuizzes() : null;
      const flashcards = selected.has('flashcards') && fetchFlashcards ? await fetchFlashcards() : null;
      const result = await createShare({
        title,
        summary: selected.has('summary') ? summary : null,
        mindMapText: selected.has('mindMap') ? mindMapText : null,
        quizzes: quizzes?.length ? quizzes : null,
        flashcards: flashcards?.length ? flashcards : null,
        sourceType,
        sourceUrl,
      });
      setShareUrl(result.shareUrl);
    } catch {
      setError('Failed to generate share link. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Share2 size={16} color={Colors.primary} />
              <Text style={styles.headerTitle} numberOfLines={1}>Share “{title}”</Text>
            </View>
            <Pressable onPress={close} hitSlop={8}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {shareUrl ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneNote}>Anyone with the link can view this content.</Text>
              <View style={styles.urlBox}>
                <Text style={styles.urlText} numberOfLines={1}>{shareUrl}</Text>
                <Pressable style={styles.copyButton} onPress={copy}>
                  {copied ? <Check size={14} color={Colors.emerald} /> : <Copy size={14} color={Colors.primary} />}
                  <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
              </View>
              <Button title="Share link…" onPress={() => { void Share.share({ message: shareUrl }); }} />
            </View>
          ) : (
            <>
              {items.length === 0 ? (
                <Text style={styles.emptyText}>
                  No content available to share yet. Generate a summary or mind map first.
                </Text>
              ) : (
                <View style={styles.itemList}>
                  {items.map(({ key, label }) => {
                    const on = selected.has(key);
                    return (
                      <Pressable key={key} style={[styles.itemRow, on && styles.itemRowOn]} onPress={() => toggle(key)}>
                        <Text style={[styles.itemLabel, on && styles.itemLabelOn]}>{label}</Text>
                        <View style={[styles.radio, on && styles.radioOn]}>
                          {on && <Check size={11} color={Colors.primaryForeground} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Button
                title="Generate share link"
                onPress={generate}
                disabled={selected.size === 0}
                loading={busy}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Overlay.backdrop },
  sheetWrap: { flex: 1, justifyContent: 'center', padding: Spacing.three },
  sheet: {
    backgroundColor: Colors.bgSidebar, borderRadius: Radius.xl, padding: Spacing.three,
    gap: Spacing.three, ...Shadows.card,
  },
  headerRow: { ...Layout.rowBetween, gap: Spacing.two },
  headerTitleGroup: { ...Layout.row, gap: Spacing.two, flex: 1 },
  headerTitle: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  itemList: { gap: Spacing.two },
  itemRow: {
    ...Layout.rowBetween, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three, paddingVertical: 12, backgroundColor: Colors.bgCard,
  },
  itemRowOn: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.tint}` },
  itemLabel: { ...Typography.body, color: Colors.textSecondary },
  itemLabelOn: { ...Typography.bodyBold, color: Colors.primary },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.border,
    ...Layout.center,
  },
  radioOn: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  emptyText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.two },
  errorText: { ...Typography.caption, color: Colors.red },
  doneBox: { gap: Spacing.two },
  doneNote: { ...Typography.caption, color: Colors.textSecondary },
  urlBox: {
    ...Layout.row, gap: Spacing.two,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: 10, backgroundColor: Colors.bgCard,
  },
  urlText: { flex: 1, fontSize: 12, color: Colors.textPrimary },
  copyButton: { ...Layout.row, gap: 4 },
  copyText: { ...Typography.captionBold, color: Colors.primary },
});

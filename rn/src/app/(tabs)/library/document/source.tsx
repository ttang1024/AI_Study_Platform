import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { documentService } from '@/services/documentService';

/**
 * The document's extracted text, with the cited passage highlighted.
 *
 * This is where a citation's "jump to source" lands. The server returns the same string the anchor
 * offsets were computed against — extracted once and stored, because PDF and image extraction falls
 * back to AI transcription and a second pass would silently move every offset.
 */
export default function DocumentSourceScreen() {
  const { id, start, end } = useLocalSearchParams<{ id: string; start?: string; end?: string }>();

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [highlightY, setHighlightY] = useState<number | null>(null);

  // Every setState happens after an await, never synchronously in the effect body: a synchronous
  // one here would trigger a second render pass before the first has committed.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await documentService.getText(id);
        if (!cancelled) setText(res.data?.data?.text ?? null);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Scrolls once the highlighted run has reported its position. Nested <Text> has no measurable
  // layout of its own, so the offset comes from an onLayout on the wrapper around it.
  useEffect(() => {
    if (highlightY === null) return;
    const timer = setTimeout(
      () => scrollRef.current?.scrollTo({ y: Math.max(0, highlightY - 120), animated: true }),
      100,
    );
    return () => clearTimeout(timer);
  }, [highlightY]);

  const segments = useMemo(() => {
    if (!text) return null;

    const startOffset = Number(start);
    const endOffset = Number(end);
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) {
      return { before: text, marked: '', after: '' };
    }

    const from = Math.max(0, Math.min(startOffset, text.length));
    const to = Math.max(from, Math.min(endOffset, text.length));

    return { before: text.slice(0, from), marked: text.slice(from, to), after: text.slice(to) };
  }, [text, start, end]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.caption}>Extracting text…</Text>
      </View>
    );
  }

  if (failed || !segments) {
    return (
      <View style={styles.centered}>
        <FileText size={28} color={Colors.textSecondary} />
        <Text style={styles.caption}>
          {failed
            ? 'Could not load this document’s text.'
            : 'This document has no extractable text layer — images are not transcribed automatically.'}
        </Text>
      </View>
    );
  }

  // Rendered as three sibling blocks rather than one <Text> with a nested run. React Native cannot
  // measure a nested <Text>, so a nested highlight has no position to scroll to — and landing on
  // the cited passage is the entire point of this screen. The cost is a line break either side of
  // the highlight, which reads acceptably on extracted text that is already hard-wrapped.
  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      {!!segments.before && (
        <Text style={styles.body} selectable>
          {segments.before}
        </Text>
      )}

      {!!segments.marked && (
        <View onLayout={(e) => setHighlightY(e.nativeEvent.layout.y)}>
          <Text style={[styles.body, styles.highlight]} selectable>
            {segments.marked}
          </Text>
        </View>
      )}

      {!!segments.after && (
        <Text style={styles.body} selectable>
          {segments.after}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    backgroundColor: Colors.bgApp,
  },
  body: { ...Typography.body, color: Colors.textPrimary, lineHeight: 23 },
  highlight: { backgroundColor: Colors.amber, color: Colors.textPrimary, borderRadius: 3 },
  caption: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
});

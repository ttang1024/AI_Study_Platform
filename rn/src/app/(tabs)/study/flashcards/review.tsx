import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { MathMarkdown } from '@/components/MathMarkdown';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';
import { containsTexMath } from '@/utils/mathMarkdownHtml';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { flashcardService } from '@/services/flashcardService';
import { offlineCache } from '@/services/offlineCache';
import type { Flashcard, FsrsRating } from '@/types';
import { cardBackText, cardFrontText } from '@/utils/flashcardDisplay';
import { isCardDue } from '@/utils/flashcardSets';

const MAX_NEW_PER_SESSION = 20;

const RATINGS: { rating: FsrsRating; label: string; color: string }[] = [
  { rating: 1, label: 'Again', color: Colors.red },
  { rating: 2, label: 'Hard', color: Colors.orange },
  { rating: 3, label: 'Good', color: Colors.emerald },
  { rating: 4, label: 'Easy', color: Colors.blue },
];

const buildQueue = (cards: Flashcard[], deckId: string | undefined): Flashcard[] => {
  const scoped = deckId ? cards.filter((c) => c.documentId === deckId || c.videoId === deckId) : cards;
  const due = scoped.filter(isCardDue).sort((a, b) => new Date(a.srs!.due).getTime() - new Date(b.srs!.due).getTime());
  const fresh = scoped.filter((c) => !c.srs).slice(0, MAX_NEW_PER_SESSION);
  return [...due, ...fresh];
};

export default function ReviewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [goodCount, setGoodCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [offline, setOffline] = useState(false);

  // Count review time toward analytics (no courseId — decks are per-source, not per-course).
  useStudyTimer({ contextType: 'flashcards', contextId: deckId, enabled: queue !== null && !offline });

  // Reading a card involves long pauses without touching the screen — don't dim mid-session.
  useKeepAwake();

  useEffect(() => {
    flashcardService.list()
      .then(({ items }) => setQueue(buildQueue(items, deckId)))
      .catch(async () => {
        // Network unreachable — browse the cached snapshot read-only instead
        // (ratings need the server, so FSRS scheduling is untouched offline).
        const cached = await offlineCache.getCachedFlashcards();
        setOffline(true);
        setQueue(deckId ? cached.filter((c) => c.documentId === deckId || c.videoId === deckId) : cached);
      });
  }, [deckId]);

  const current = queue?.[index];

  const frontText = useMemo(() => (current ? cardFrontText(current) : ''), [current]);
  const backText = useMemo(() => (current ? cardBackText(current) : ''), [current]);

  const rate = async (rating: FsrsRating) => {
    if (!current || submitting) return;
    if (rating >= 3) haptics.success(); else haptics.error();
    setSubmitting(true);
    const difficulty = rating === 4 ? 'easy' : rating === 3 ? 'medium' : 'hard';
    await Promise.allSettled([
      flashcardService.review(current.id, rating),
      flashcardService.classify(current.id, { difficulty }),
    ]);
    setReviewedCount((n) => n + 1);
    if (rating >= 3) setGoodCount((n) => n + 1);
    setSubmitting(false);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  if (!queue) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>No cards to review</Text>
        <Button title="Close" onPress={() => router.back()} />
      </View>
    );
  }

  if (index >= queue.length && !offline) {
    const pct = reviewedCount === 0 ? 0 : Math.round((goodCount / reviewedCount) * 100);
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>Session complete</Text>
        <Text style={styles.donePct}>{pct}% good</Text>
        <Text style={styles.doneSubtitle}>{reviewedCount} card{reviewedCount === 1 ? '' : 's'} reviewed</Text>
        <Button title="Done" onPress={() => router.back()} />
      </View>
    );
  }

  const browse = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + queue.length) % queue.length);
  };

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {offline ? 'Offline · read-only · ' : ''}{index + 1} / {queue.length}
        </Text>
      </View>

      <Pressable style={styles.card} onPress={() => { haptics.tap(); setFlipped((f) => !f); }}>
        <Text style={styles.cardLabel}>{flipped ? 'Answer' : 'Question'}</Text>
        {containsTexMath(flipped ? backText : frontText) ? (
          <View style={styles.mathWrap}>
            <MathMarkdown value={flipped ? backText : frontText} pointerEventsNone />
          </View>
        ) : (
          <Text style={styles.cardText}>{flipped ? backText : frontText}</Text>
        )}
        {!flipped && <Text style={styles.tapHint}>Tap to reveal</Text>}
      </Pressable>

      {offline && (
        <View style={styles.ratingRow}>
          <Pressable style={styles.navButton} onPress={() => browse(-1)}>
            <Text style={styles.navButtonText}>‹ Previous</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={() => browse(1)}>
            <Text style={styles.navButtonText}>Next ›</Text>
          </Pressable>
        </View>
      )}

      {flipped && !offline && (
        <View style={styles.ratingRow}>
          {RATINGS.map((r) => (
            <Pressable
              key={r.rating}
              style={[styles.ratingButton, { backgroundColor: r.color }, submitting && styles.ratingDisabled]}
              onPress={() => rate(r.rating)}
              disabled={submitting}
            >
              <Text style={styles.ratingText}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three, gap: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp, gap: Spacing.two, padding: Spacing.five },
  progressRow: { alignItems: 'center' },
  progressText: { ...Typography.captionBold, color: Colors.textSecondary },
  card: {
    flex: 1, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two,
  },
  cardLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  cardText: { ...Typography.heading, color: Colors.textPrimary, textAlign: 'center' },
  mathWrap: { alignSelf: 'stretch' },
  tapHint: { ...Typography.caption, color: Colors.textSecondary, position: 'absolute', bottom: Spacing.three },
  ratingRow: { flexDirection: 'row', gap: Spacing.two },
  ratingButton: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center' },
  navButton: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  navButtonText: { ...Typography.bodyBold, color: Colors.textPrimary },
  ratingDisabled: { opacity: 0.6 },
  ratingText: { ...Typography.bodyBold, color: Colors.primaryForeground },
  doneTitle: { ...Typography.heading, color: Colors.textPrimary },
  donePct: { ...Typography.title, color: Colors.primary },
  doneSubtitle: { ...Typography.caption, color: Colors.textSecondary },
});

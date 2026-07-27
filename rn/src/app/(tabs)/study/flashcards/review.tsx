import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/Button';
import { MathMarkdown } from '@/components/MathMarkdown';
import { PressableScale } from '@/components/PressableScale';
import { ProgressBar } from '@/components/ProgressBar';
import { FlipCard } from '@/components/study/FlipCard';
import { Colors, Layout, Motion, Radius, Spacing, Typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';
import { containsTexMath } from '@/utils/mathMarkdownHtml';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { flashcardService } from '@/services/flashcardService';
import { offlineCache } from '@/services/offlineCache';
import type { Flashcard, FsrsRating } from '@/types';
import { cardBackText, cardFrontText } from '@/utils/flashcardDisplay';
import { isCardDue } from '@/utils/flashcardSets';
import { SourceCitation } from '@/components/study/SourceCitation';

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
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.doneBlock}>
          <Text style={styles.doneTitle}>Session complete</Text>
          <AnimatedNumber value={pct} format={(n) => `${n}% good`} style={styles.donePct} />
          <Text style={styles.doneSubtitle}>{reviewedCount} card{reviewedCount === 1 ? '' : 's'} reviewed</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(Motion.duration.base)} style={styles.doneAction}>
          <Button title="Done" onPress={() => router.back()} />
        </Animated.View>
      </View>
    );
  }

  const browse = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + queue.length) % queue.length);
  };

  const faceContent = (text: string, label: string, hint?: string) => (
    <>
      <Text style={styles.cardLabel}>{label}</Text>
      {containsTexMath(text) ? (
        <View style={styles.mathWrap}>
          <MathMarkdown value={text} pointerEventsNone />
        </View>
      ) : (
        <Text style={styles.cardText}>{text}</Text>
      )}
      {!!hint && <Text style={styles.tapHint}>{hint}</Text>}
    </>
  );

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {offline ? 'Offline · read-only · ' : ''}{index + 1} / {queue.length}
        </Text>
        <ProgressBar progress={(index + 1) / queue.length} height={4} />
      </View>

      {/* Keyed on the card id so advancing the queue remounts the FlipCard: the
          next card animates in face-up, rather than inheriting the previous
          card's flipped rotation and appearing to un-flip itself. */}
      <FlipCard
        key={current?.id ?? index}
        flipped={flipped}
        onPress={() => { haptics.tap(); setFlipped((f) => !f); }}
        style={styles.cardWrap}
        faceStyle={styles.card}
        front={faceContent(frontText, 'Question', 'Tap to reveal')}
        back={faceContent(backText, 'Answer')}
      />

      {offline && (
        <View style={styles.ratingRow}>
          <PressableScale style={styles.navButton} onPress={() => browse(-1)}>
            <Text style={styles.navButtonText}>‹ Previous</Text>
          </PressableScale>
          <PressableScale style={styles.navButton} onPress={() => browse(1)}>
            <Text style={styles.navButtonText}>Next ›</Text>
          </PressableScale>
        </View>
      )}

      {/* Only once the answer is revealed — showing the source quote alongside the question would
          give the answer away. */}
      {flipped && !!current && (
        <View style={styles.citationRow}>
          <SourceCitation
            citation={current.citation}
            documentId={current.documentId}
            videoId={current.videoId}
          />
        </View>
      )}

      {flipped && !offline && (
        <View style={styles.ratingRow}>
          {RATINGS.map((r, i) => (
            // Staggered so the four buttons cascade in behind the flip instead
            // of popping in as a block the instant the card starts rotating.
            <Animated.View
              key={r.rating}
              entering={FadeInDown.delay(Motion.stagger(i, 40)).duration(Motion.duration.base)}
              style={styles.ratingSlot}
            >
              <PressableScale
                style={[styles.ratingButton, { backgroundColor: r.color }]}
                onPress={() => rate(r.rating)}
                disabled={submitting}
              >
                <Text style={styles.ratingText}>{r.label}</Text>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three, gap: Spacing.three },
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp, gap: Spacing.two, padding: Spacing.five },
  progressRow: { alignItems: 'center', gap: Spacing.two },
  progressText: { ...Typography.captionBold, color: Colors.textSecondary },
  cardWrap: { flex: 1 },
  // Surface styling only — FlipCard absolutely stacks the two faces, so the
  // face itself must not claim flex.
  card: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, ...Layout.center, padding: Spacing.four, gap: Spacing.two,
  },
  cardLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  cardText: { ...Typography.heading, color: Colors.textPrimary, textAlign: 'center' },
  mathWrap: { alignSelf: 'stretch' },
  tapHint: { ...Typography.caption, color: Colors.textSecondary, position: 'absolute', bottom: Spacing.three },
  citationRow: { paddingHorizontal: Spacing.three, marginBottom: Spacing.two },
  ratingRow: { ...Layout.row, gap: Spacing.two },
  // The stagger wrapper carries the flex, so each of the four buttons still
  // takes an equal share of the row.
  ratingSlot: { flex: 1 },
  ratingButton: { paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center' },
  navButton: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  navButtonText: { ...Typography.bodyBold, color: Colors.textPrimary },
  ratingText: { ...Typography.bodyBold, color: Colors.primaryForeground },
  doneBlock: { alignItems: 'center', gap: Spacing.one },
  doneAction: { alignSelf: 'stretch', marginTop: Spacing.two },
  doneTitle: { ...Typography.heading, color: Colors.textPrimary },
  donePct: { ...Typography.title, color: Colors.primary },
  doneSubtitle: { ...Typography.caption, color: Colors.textSecondary },
});

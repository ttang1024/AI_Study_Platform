import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { MathMarkdown } from '@/components/MathMarkdown';
import { PressableScale } from '@/components/PressableScale';
import { FlipCard } from '@/components/study/FlipCard';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';
import { cardBackText, cardFrontText } from '@/utils/flashcardDisplay';
import { containsTexMath } from '@/utils/mathMarkdownHtml';
import type { SimpleCard } from '@/types';
import Layers from 'lucide-react-native/icons/layers';

interface FlashcardsSectionProps {
  /** Cards already generated for this source; loaded once on mount. */
  getCards: () => Promise<SimpleCard[]>;
  /** Generate a fresh deck for this source (AI); returns the new cards. */
  generateCards: () => Promise<SimpleCard[]>;
  /** Deck id (documentId / videoId) so the Review button can scope FSRS to it. */
  deckId: string;
}

/**
 * Per-source "Cards" tab — mirrors the web detail pages' Flashcards tab.
 *
 * Browses this material's flashcards with the same flip animation as the review
 * screen, but read-only (no FSRS rating). A "Review" shortcut hands off to the
 * spaced-repetition flow scoped to this deck. Shared by document/[id].tsx and
 * video/[id].tsx.
 */
export const FlashcardsSection: React.FC<FlashcardsSectionProps> = ({ getCards, generateCards, deckId }) => {
  const router = useRouter();
  const [cards, setCards] = useState<SimpleCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);

  // The parent passes fresh closures each render (they capture the source id);
  // keep them in refs so the load effect can fire once per deck, not per render.
  const getCardsRef = useRef(getCards);
  const generateCardsRef = useRef(generateCards);
  useEffect(() => {
    getCardsRef.current = getCards;
    generateCardsRef.current = generateCards;
  });

  useEffect(() => {
    let active = true;
    getCardsRef.current()
      .then((c) => { if (active) setCards(c); })
      .catch(() => { if (active) setCards([]); });
    return () => { active = false; };
  }, [deckId]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const fresh = await generateCardsRef.current();
      setCards(fresh);
      setIndex(0);
      setFlipped(false);
    } catch {
      // Leave the empty state up so the user can retry.
    } finally {
      setGenerating(false);
    }
  }, []);

  const current = cards?.[index];
  const frontText = useMemo(() => (current ? cardFrontText(current) : ''), [current]);
  const backText = useMemo(() => (current ? cardBackText(current) : ''), [current]);

  if (cards === null) {
    return <ActivityIndicator color={Colors.primary} style={styles.loading} />;
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No Cards Yet"
        subtitle="Turn this material into flashcards for spaced-repetition review."
        action={{ label: generating ? 'Generating…' : 'Generate Cards', onPress: generate, loading: generating }}
        bordered
      />
    );
  }

  const browse = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + cards.length) % cards.length);
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
      <View style={styles.headerRow}>
        <Text style={styles.count}>{index + 1} / {cards.length}</Text>
        <PressableScale
          style={styles.reviewButton}
          onPress={() => router.push({ pathname: '/study/flashcards/review', params: { deckId } })}
        >
          <Text style={styles.reviewButtonText}>Review</Text>
        </PressableScale>
      </View>

      {/* Keyed on the card id so paging remounts the FlipCard face-up rather than
          inheriting the previous card's flipped rotation. */}
      <FlipCard
        key={current?.id ?? index}
        flipped={flipped}
        onPress={() => { haptics.tap(); setFlipped((f) => !f); }}
        style={styles.cardWrap}
        faceStyle={styles.card}
        front={faceContent(frontText, 'Question', 'Tap to reveal')}
        back={faceContent(backText, 'Answer')}
      />

      <View style={styles.navRow}>
        <PressableScale style={styles.navButton} onPress={() => browse(-1)}>
          <Text style={styles.navButtonText}>‹ Previous</Text>
        </PressableScale>
        <PressableScale style={styles.navButton} onPress={() => browse(1)}>
          <Text style={styles.navButtonText}>Next ›</Text>
        </PressableScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  loading: { marginTop: Spacing.five },
  headerRow: { ...Layout.row, justifyContent: 'space-between', alignItems: 'center' },
  count: { ...Typography.captionBold, color: Colors.textSecondary },
  reviewButton: {
    paddingHorizontal: Spacing.three, paddingVertical: 8, borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  reviewButtonText: { ...Typography.captionBold, color: Colors.primaryForeground },
  // FlipCard absolutely stacks its two faces, so the wrapper carries the height.
  cardWrap: { height: 260 },
  card: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, ...Layout.center, padding: Spacing.four, gap: Spacing.two,
  },
  cardLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  cardText: { ...Typography.heading, color: Colors.textPrimary, textAlign: 'center' },
  mathWrap: { alignSelf: 'stretch' },
  tapHint: { ...Typography.caption, color: Colors.textSecondary, position: 'absolute', bottom: Spacing.three },
  navRow: { ...Layout.row, gap: Spacing.two },
  navButton: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  navButtonText: { ...Typography.bodyBold, color: Colors.textPrimary },
});

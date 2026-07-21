import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { ShareableCard } from '@/services/shareService';
import { sharedSectionStyles } from './sharedSectionStyles';

/** Read-only flip-through deck (shared cards have no SRS state to rate). */
export const SharedFlashcards: React.FC<{ cards: ShareableCard[] }> = ({ cards }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const go = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + cards.length) % cards.length);
  };
  return (
    <View style={sharedSectionStyles.sectionCard}>
      <Text style={sharedSectionStyles.sectionLabel}>Flashcards · {index + 1} / {cards.length}</Text>
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

const styles = StyleSheet.create({
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
});

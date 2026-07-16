import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { flashcardService } from '@/services/flashcardService';
import type { Flashcard } from '@/types';
import { cardBackText, cardFrontText } from '@/utils/flashcardDisplay';
import { isCardDue } from '@/utils/flashcardSets';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    flashcardService.list().then(({ items }) => {
      const deckCards = items.filter((c) => c.documentId === id || c.videoId === id);
      setCards(deckCards);
      const name = deckCards[0]?.documentName ?? deckCards[0]?.videoName ?? 'Deck';
      navigation.setOptions({ title: name });
    }).finally(() => setLoading(false));
  }, [id, navigation]);

  const dueCount = cards.filter(isCardDue).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.actions}>
        <Button
          title={dueCount > 0 ? `Start Review (${dueCount} due)` : 'Review all cards'}
          onPress={() => router.push({ pathname: '/study/flashcards/review', params: { deckId: id } })}
        />
      </View>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.cardItem}>
            <Text style={styles.front}>{cardFrontText(item)}</Text>
            <Text style={styles.back}>{cardBackText(item)}</Text>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp },
  actions: { padding: Spacing.three },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  cardItem: { gap: 6 },
  front: { ...Typography.bodyBold, color: Colors.textPrimary },
  back: { ...Typography.caption, color: Colors.textSecondary },
});

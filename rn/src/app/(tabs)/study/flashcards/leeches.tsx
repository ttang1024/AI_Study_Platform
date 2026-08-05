import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Bug from 'lucide-react-native/icons/bug';
import PauseCircle from 'lucide-react-native/icons/circle-pause';
import PlayCircle from 'lucide-react-native/icons/circle-play';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Sparkles from 'lucide-react-native/icons/sparkles';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { InfoBanner } from '@/components/InfoBanner';
import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { flashcardService } from '@/services/flashcardService';
import type { Flashcard } from '@/types';
import { cardBackText, cardFrontText } from '@/utils/flashcardDisplay';
import { getApiErrorMessage } from '@/utils/apiError';
import { haptics } from '@/utils/haptics';

/**
 * Cards the FSRS scheduler keeps failing (lapses ≥ 4, worst-first — same rule and endpoint as
 * web's LeechesTab). No card editor exists on mobile yet, so the remedies here are the two the
 * app can actually offer: suspend it (keep the card, drop it from every review queue) or reset
 * its scheduling (start over as new). Editing front/back stays a web-only action for now.
 */
export default function LeechesScreen() {
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    flashcardService.getLeeches().then(setCards).catch(() => setCards([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSuspended = async (card: Flashcard) => {
    if (!card.srs) return;
    setBusyId(card.id);
    try {
      const srs = await flashcardService.setSuspended(card.id, !card.srs.isSuspended);
      haptics.tap();
      setCards((prev) => prev?.map((c) => (c.id === card.id ? { ...c, srs } : c)) ?? prev);
    } catch (e) {
      Alert.alert('Couldn’t update card', getApiErrorMessage(e, 'Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const resetCard = (card: Flashcard) => {
    Alert.alert(
      'Reset scheduling?',
      'This card starts over as a new card. Its review history is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setBusyId(card.id);
            try {
              await flashcardService.resetSrs(card.id);
              haptics.success();
              setCards((prev) => prev?.filter((c) => c.id !== card.id) ?? prev);
            } catch (e) {
              Alert.alert('Couldn’t reset card', getApiErrorMessage(e, 'Please try again.'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (cards === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No leeches"
        subtitle="A card becomes a leech once you keep forgetting it (4+ lapses). Every card is sticking right now."
      />
    );
  }

  return (
    <FlatList
      data={cards}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <InfoBanner
          icon={Bug}
          text={`${cards.length} card${cards.length === 1 ? '' : 's'} you keep forgetting. Suspend a card if it isn’t worth the effort, or reset it for a fresh start.`}
        />
      }
      ListHeaderComponentStyle={styles.header}
      renderItem={({ item }) => (
        <LeechRow
          card={item}
          busy={busyId === item.id}
          onToggleSuspend={() => toggleSuspended(item)}
          onReset={() => resetCard(item)}
        />
      )}
    />
  );
}

const LeechRow: React.FC<{
  card: Flashcard;
  busy: boolean;
  onToggleSuspend: () => void;
  onReset: () => void;
}> = ({ card, busy, onToggleSuspend, onReset }) => {
  const suspended = card.srs?.isSuspended ?? false;
  return (
    <Card style={[styles.row, suspended && styles.rowSuspended]}>
      <Text style={styles.front} numberOfLines={2}>{cardFrontText(card)}</Text>
      <Text style={styles.back} numberOfLines={2}>{cardBackText(card)}</Text>

      <View style={styles.badgeRow}>
        <View style={styles.lapsesBadge}>
          <Text style={styles.lapsesBadgeText}>{card.srs?.lapses ?? 0} lapses</Text>
        </View>
        {!!card.srs?.reps && <Text style={styles.repsText}>{card.srs.reps} reviews</Text>}
        {(card.documentName ?? card.videoName) && (
          <Text style={styles.sourceText} numberOfLines={1}>{card.documentName ?? card.videoName}</Text>
        )}
        {suspended && (
          <View style={styles.suspendedBadge}>
            <Text style={styles.suspendedBadgeText}>Suspended</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <PressableScale style={styles.actionButton} onPress={onToggleSuspend} disabled={busy}>
          {suspended ? <PlayCircle size={14} color={Colors.textSecondary} /> : <PauseCircle size={14} color={Colors.textSecondary} />}
          <Text style={styles.actionText}>{suspended ? 'Resume' : 'Suspend'}</Text>
        </PressableScale>
        <PressableScale style={styles.actionButton} onPress={onReset} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color={Colors.red} /> : <RotateCcw size={14} color={Colors.red} />}
          <Text style={[styles.actionText, { color: Colors.red }]}>Reset</Text>
        </PressableScale>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp },
  list: { padding: Spacing.three, gap: Spacing.two, backgroundColor: Colors.bgApp, flexGrow: 1 },
  header: { marginBottom: Spacing.one },
  row: { gap: 6 },
  rowSuspended: { opacity: 0.6 },
  front: { ...Typography.bodyBold, color: Colors.textPrimary },
  back: { ...Typography.caption, color: Colors.textSecondary },
  badgeRow: { ...Layout.row, flexWrap: 'wrap', gap: 6, marginTop: 2 },
  lapsesBadge: { backgroundColor: `${Colors.red}${Alpha.tint}`, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  lapsesBadgeText: { ...Typography.captionBold, fontSize: 10, color: Colors.red },
  repsText: { ...Typography.caption, fontSize: 10, color: Colors.textSecondary },
  sourceText: { ...Typography.caption, fontSize: 10, color: Colors.textSecondary, flexShrink: 1 },
  suspendedBadge: { backgroundColor: Colors.zinc200, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  suspendedBadgeText: { ...Typography.captionBold, fontSize: 10, color: Colors.textSecondary },
  actions: { ...Layout.row, gap: Spacing.two, marginTop: Spacing.one, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.two },
  actionButton: { ...Layout.row, gap: 5, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6 },
  actionText: { ...Typography.captionBold, fontSize: 12, color: Colors.textSecondary },
});

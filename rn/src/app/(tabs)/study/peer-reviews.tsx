import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Inbox from 'lucide-react-native/icons/inbox';
import Users from 'lucide-react-native/icons/users';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/TextField';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import {
  peerReviewService,
  type PeerReviewAssignment,
  type PeerReviewScore,
  type PeerReviewWorkspace,
} from '@/services/peerReviewService';
import { getApiErrorMessage } from '@/utils/apiError';

/**
 * The reviewer's side of peer review: a queue of drafts, and the workspace for one of them.
 * The author's side lives with their essay — the two roles never share a screen.
 */
export default function PeerReviewsScreen() {
  const [queue, setQueue] = useState<PeerReviewAssignment[] | null>(null);
  const [open, setOpen] = useState<PeerReviewWorkspace | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await peerReviewService.getMyQueue(true);
      setQueue(res.data.data);
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const openReview = async (id: string) => {
    setBusy(true); setError('');
    try {
      const res = await peerReviewService.open(id);
      setOpen(res.data.data);
      setScores(
        Object.fromEntries(res.data.data.existingScores.map((s) => [s.criterionName, String(s.points)])),
      );
      setComment(res.data.data.existingComment ?? '');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open that draft.'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!open) return;
    setBusy(true); setError('');
    try {
      const payload: PeerReviewScore[] = open.criteria.map((c) => ({
        criterionName: c.name,
        points: Number(scores[c.name] ?? 0) || 0,
        comment: null,
      }));
      await peerReviewService.submit(open.essayPeerReviewId, payload, comment || null);
      setOpen(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send your review.'));
    } finally {
      setBusy(false);
    }
  };

  if (queue === null) {
    return (
      <View style={Layout.fillCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (open) {
    const readOnly = open.status === 'submitted';
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Button title="← Back to queue" variant="secondary" onPress={() => setOpen(null)} />
        {!!error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.title}>{open.essayTitle}</Text>
        {!!open.promptText && <Text style={styles.meta}>Prompt: {open.promptText}</Text>}
        <Text style={styles.meta}>{open.wordCount} words</Text>

        <Card style={styles.essayCard}>
          <Text selectable style={styles.essayText}>{open.essayText}</Text>
        </Card>

        {open.criteria.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Score against the rubric</Text>
            {open.criteria.map((criterion) => (
              <View key={criterion.name} style={styles.criterionRow}>
                <View style={styles.criterionBody}>
                  <Text style={styles.criterionName}>{criterion.name}</Text>
                  {!!criterion.description && (
                    <Text style={styles.meta}>{criterion.description}</Text>
                  )}
                </View>
                <View style={styles.scoreBox}>
                  <TextField
                    value={scores[criterion.name] ?? ''}
                    onChangeText={(v) => setScores((prev) => ({ ...prev, [criterion.name]: v }))}
                    keyboardType="number-pad"
                    editable={!readOnly}
                    placeholder="0"
                  />
                  <Text style={styles.meta}>/ {criterion.maxPoints}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Your feedback</Text>
          <TextField
            value={comment}
            onChangeText={setComment}
            multiline
            editable={!readOnly}
            placeholder="What worked, and what would you change?"
            style={styles.commentInput}
          />
        </Card>

        {readOnly ? (
          <Text style={styles.meta}>You&apos;ve already sent this review.</Text>
        ) : (
          <Button title="Send review" onPress={submit} loading={busy} />
        )}
      </ScrollView>
    );
  }

  const pending = queue.filter((q) => q.status === 'assigned');
  const done = queue.filter((q) => q.status === 'submitted');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Users size={22} color={Colors.primary} />
        <Text style={styles.title}>Drafts to review</Text>
      </View>
      <Text style={styles.meta}>
        Classmates have asked for your feedback. Your name isn&apos;t shown to them.
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {queue.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing to review right now" bordered />
      ) : (
        [...pending, ...done].map((item) => (
          <Card key={item.essayPeerReviewId} style={styles.card}>
            <Text style={styles.cardTitle}>{item.essayTitle}</Text>
            <Text style={styles.meta}>
              {item.wordCount} words · asked {new Date(item.assignedAt).toLocaleDateString()}
              {item.status === 'submitted' ? ' · reviewed' : ''}
            </Text>
            <Button
              title={item.status === 'submitted' ? 'View' : 'Review'}
              variant={item.status === 'submitted' ? 'secondary' : 'primary'}
              onPress={() => openReview(item.essayPeerReviewId)}
              loading={busy}
            />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  row: { ...Layout.row, gap: Spacing.two },
  title: { ...Typography.heading, color: Colors.textPrimary },
  card: { gap: Spacing.two },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  essayCard: { maxHeight: 320 },
  essayText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 22 },
  criterionRow: { ...Layout.rowBetween, gap: Spacing.two },
  criterionBody: { flex: 1 },
  criterionName: { ...Typography.body, color: Colors.textPrimary },
  scoreBox: { ...Layout.row, gap: Spacing.one, width: 110 },
  commentInput: { minHeight: 120, textAlignVertical: 'top', borderRadius: Radius.md },
  error: { ...Typography.caption, color: Colors.errorText },
});

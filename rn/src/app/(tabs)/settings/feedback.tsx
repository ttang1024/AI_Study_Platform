import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bug, CheckCircle2, Lightbulb, MessageCircle, Star } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { Alpha, Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';

type FeedbackType = 'bug' | 'feature' | 'general';

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: LucideIcon; description: string }[] = [
  { id: 'bug', label: 'Bug Report', icon: Bug, description: 'Something is broken or not working' },
  { id: 'feature', label: 'Feature Request', icon: Lightbulb, description: 'Suggest a new idea or improvement' },
  { id: 'general', label: 'General Feedback', icon: MessageCircle, description: 'Share your thoughts or experience' },
];

export default function FeedbackScreen() {
  const [type, setType] = useState<FeedbackType>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/api/feedback', {
        type,
        subject: subject.trim(),
        message: message.trim(),
        rating: rating > 0 ? rating : null,
      });
      setSubmitted(true);
    } catch {
      setError('Couldn’t send your feedback right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setType('general');
    setSubject('');
    setMessage('');
    setRating(0);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <View style={styles.center}>
        <CheckCircle2 size={44} color={Colors.emerald} />
        <Text style={styles.thanksTitle}>Thanks for the feedback!</Text>
        <Text style={styles.thanksSubtitle}>We read every message — it helps make the app better.</Text>
        <Button title="Send another" variant="secondary" onPress={reset} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>What kind of feedback?</Text>
      {FEEDBACK_TYPES.map((t) => {
        const active = type === t.id;
        const Icon = t.icon;
        return (
          <Pressable key={t.id} onPress={() => setType(t.id)}>
            <Card style={StyleSheet.flatten([styles.typeCard, active && styles.typeCardActive])}>
              <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                <Icon size={17} color={active ? Colors.primary : Colors.textSecondary} />
              </View>
              <View style={styles.typeBody}>
                <Text style={styles.typeLabel}>{t.label}</Text>
                <Text style={styles.typeDescription}>{t.description}</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}

      <TextField label="Subject" value={subject} onChangeText={setSubject} placeholder="A short summary" autoCapitalize="sentences" autoCorrect />
      <TextField
        label="Message"
        value={message}
        onChangeText={setMessage}
        placeholder="Tell us more…"
        autoCapitalize="sentences"
        autoCorrect
        multiline
        style={styles.messageInput}
      />

      <Text style={styles.sectionLabel}>How’s the app overall? (optional)</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n === rating ? 0 : n)} hitSlop={4}>
            <Star
              size={28}
              color={n <= rating ? Colors.amber : Colors.zinc300}
              fill={n <= rating ? Colors.amber : 'transparent'}
            />
          </Pressable>
        ))}
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button
        title={submitting ? 'Sending…' : 'Send Feedback'}
        onPress={submit}
        disabled={submitting || !subject.trim() || !message.trim()}
        loading={submitting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four, backgroundColor: Colors.bgApp },
  thanksTitle: { ...Typography.heading, color: Colors.textPrimary },
  thanksSubtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.two },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: Spacing.two },
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two, borderWidth: 2, borderColor: 'transparent' },
  typeCardActive: { borderColor: Colors.primary },
  typeIcon: {
    width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.bgApp,
    alignItems: 'center', justifyContent: 'center',
  },
  typeIconActive: { backgroundColor: `${Colors.primary}${Alpha.tint}` },
  typeBody: { flex: 1 },
  typeLabel: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary },
  typeDescription: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  messageInput: { height: 120, textAlignVertical: 'top', paddingTop: 12 },
  starRow: { flexDirection: 'row', gap: Spacing.two },
  errorText: { ...Typography.caption, color: Colors.errorText },
});

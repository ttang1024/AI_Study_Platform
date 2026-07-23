import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import PenLine from 'lucide-react-native/icons/pen-line';
import X from 'lucide-react-native/icons/x';
import type { LucideIcon } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { useChatAttachments } from '@/hooks/useChatAttachments';
import { handwritingService, type HandwritingGrade, type StepVerdict } from '@/services/handwritingService';

/**
 * How each step's verdict reads. "consequent" is the one that matters: a step that is wrong only
 * because it faithfully carries an earlier mistake forward is not a second mistake, and flagging it
 * as one buries the actual error.
 */
const VERDICT: Record<StepVerdict, { label: string; icon: LucideIcon; color: string }> = {
  correct: { label: 'Correct', icon: CheckCircle2, color: Colors.emerald },
  incorrect: { label: 'This is where it broke', icon: X, color: Colors.red },
  consequent: { label: 'Follows from the error above', icon: AlertTriangle, color: Colors.amber },
  unclear: { label: 'Could not read', icon: HelpCircle, color: Colors.textSecondary },
};

export default function HandwritingScreen() {
  // The chat composer's picker already returns base64 images from the camera or the roll, which is
  // exactly the payload the grading endpoint takes.
  const { attachments, pickCamera, pickImages, removeAttachment, clearAttachments } = useChatAttachments();
  const [problem, setProblem] = useState('');
  const [grade, setGrade] = useState<HandwritingGrade | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photos = attachments.filter(a => a.isImage);

  const submit = async () => {
    if (photos.length === 0 || isGrading) return;
    setIsGrading(true);
    setError(null);
    setGrade(null);

    try {
      const result = await handwritingService.grade(
        photos.map(p => ({ data: p.data, mimeType: p.mimeType, fileName: p.fileName })),
        problem,
      );
      setGrade(result);
    } catch {
      setError('Could not grade that. Try a sharper, better-lit photo.');
    } finally {
      setIsGrading(false);
    }
  };

  const reset = () => {
    clearAttachments();
    setGrade(null);
    setError(null);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <PenLine size={22} color={Colors.primary} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Check my working</Text>
          <Text style={styles.subtitle}>
            Photograph a worked solution and find out where the reasoning first went wrong — not just
            whether the final answer matched.
          </Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>The problem (optional)</Text>
        <Text style={styles.hint}>
          If it isn&apos;t written on the page, typing it here makes the grade markedly more reliable.
        </Text>
        <TextInput
          value={problem}
          onChangeText={setProblem}
          placeholder="e.g. Solve for x: 2x² − 8x + 6 = 0"
          placeholderTextColor={Colors.textSecondary}
          multiline
          style={styles.input}
        />

        <Text style={[styles.label, styles.spaced]}>Your working</Text>
        <View style={styles.photoRow}>
          {photos.map(photo => (
            <View key={photo.id} style={styles.thumbWrap}>
              <Image source={{ uri: photo.previewUri }} style={styles.thumb} />
              <Pressable
                onPress={() => removeAttachment(photo.id)}
                style={styles.thumbRemove}
                accessibilityLabel="Remove photo"
              >
                <X size={12} color={Colors.white} />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.pickRow}>
          <Button title="Camera" variant="secondary" onPress={() => { void pickCamera(); }} />
          <Button title="Photos" variant="secondary" onPress={() => { void pickImages(); }} />
        </View>

        {photos.length > 1 && (
          <Text style={styles.hint}>
            {photos.length} pages — graded together as one continuous solution.
          </Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          <Button
            title={isGrading ? 'Reading your working…' : 'Check my working'}
            onPress={() => { void submit(); }}
            disabled={photos.length === 0 || isGrading}
            loading={isGrading}
          />
          {(photos.length > 0 || grade) && (
            <Button title="Clear" variant="secondary" onPress={reset} />
          )}
        </View>
      </Card>

      {isGrading && <ActivityIndicator color={Colors.primary} style={styles.spinner} />}

      {grade && <GradeResult grade={grade} />}
    </ScrollView>
  );
}

function GradeResult({ grade }: { grade: HandwritingGrade }) {
  const headline = grade.isCorrect
    ? 'This is correct all the way through'
    : grade.firstErrorStep != null
      ? `The reasoning breaks at step ${grade.firstErrorStep}`
      : 'Something is off in this working';

  const accent = grade.isCorrect ? Colors.emerald : Colors.amber;

  return (
    <Card style={styles.card}>
      <View style={[styles.banner, { borderColor: accent, backgroundColor: `${accent}${Alpha.wash}` }]}>
        <Text style={[styles.bannerTitle, { color: accent }]}>{headline}</Text>
        <Text style={styles.bannerBody}>{grade.summary}</Text>
      </View>

      {grade.correctedStep && (
        <View style={styles.corrected}>
          <Text style={styles.label}>What that step should have been</Text>
          <Text style={styles.mono}>{grade.correctedStep}</Text>
        </View>
      )}

      {grade.steps.map(step => {
        const meta = VERDICT[step.verdict];
        const Icon = meta.icon;
        return (
          <View
            key={step.step}
            style={[styles.step, { borderColor: `${meta.color}${Alpha.strong}`, backgroundColor: `${meta.color}${Alpha.wash}` }]}
          >
            <View style={styles.stepHead}>
              <Icon size={14} color={meta.color} />
              <Text style={[styles.stepLabel, { color: meta.color }]}>
                Step {step.step} — {meta.label}
              </Text>
            </View>
            <Text style={styles.mono}>{step.text}</Text>
            {!!step.comment && <Text style={styles.hint}>{step.comment}</Text>}
          </View>
        );
      })}

      {grade.concepts.length > 0 && (
        <View style={styles.spaced}>
          <Text style={styles.label}>Worth reviewing</Text>
          <View style={styles.chips}>
            {grade.concepts.map(concept => (
              <Text key={concept} style={styles.chip}>{concept}</Text>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  header: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  headerText: { flex: 1, gap: 4 },
  title: { ...Typography.screenTitle, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
  card: { gap: Spacing.two, padding: Spacing.three },
  label: { ...Typography.subheading, color: Colors.textPrimary },
  hint: { ...Typography.caption, color: Colors.textSecondary },
  spaced: { marginTop: Spacing.three },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.two,
    minHeight: 60,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumbWrap: { position: 'relative' },
  thumb: { width: 96, height: 96, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.red,
    borderRadius: 999,
    padding: 4,
  },
  pickRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  spinner: { marginTop: Spacing.three },
  error: { ...Typography.caption, color: Colors.red, marginTop: Spacing.two },
  banner: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three, gap: 4 },
  bannerTitle: { ...Typography.subheading },
  bannerBody: { ...Typography.caption, color: Colors.textSecondary },
  corrected: { gap: 4, marginTop: Spacing.two },
  step: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three, gap: 6, marginTop: Spacing.two },
  stepHead: { ...Layout.row, gap: 6 },
  stepLabel: { ...Typography.caption, fontWeight: '700' },
  mono: { ...Typography.body, color: Colors.textPrimary, fontFamily: 'monospace' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginTop: Spacing.one },
  chip: {
    ...Typography.caption,
    color: Colors.textSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
});

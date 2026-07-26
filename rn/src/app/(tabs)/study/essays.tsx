import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import PenLine from 'lucide-react-native/icons/pen-line';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash-2';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EssayFeedbackPanel } from '@/components/study/EssayFeedbackPanel';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { essayService, type EssaySubmission, type Rubric, type RubricCriterion } from '@/services/essayService';

type View_ = 'list' | 'editor' | 'rubrics';

export default function EssaysScreen() {
  const [essays, setEssays] = useState<EssaySubmission[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [chain, setChain] = useState<EssaySubmission[]>([]);
  const [view, setView] = useState<View_>('list');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [draft, setDraft] = useState({ title: '', promptText: '', text: '', rubricId: '' });

  const latest = chain.length > 0 ? chain[chain.length - 1] : null;

  const load = useCallback(async () => {
    const [e, r] = await Promise.allSettled([essayService.getEssays(), essayService.getRubrics()]);
    if (e.status === 'fulfilled') setEssays(e.value.data?.data ?? []);
    if (r.status === 'fulfilled') setRubrics(r.value.data?.data ?? []);
    setLoading(false);
  }, []);

  // Wrapped so every setState lands in an async continuation rather than the effect body. Each
  // `load` begins with an await, so nothing was setting state synchronously anyway — this just
  // makes that visible to the compiler's effect analysis.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const open = async (submissionId: string) => {
    setError('');
    try {
      const res = await essayService.getRevisions(submissionId);
      const revisions = res.data?.data ?? [];
      setChain(revisions);
      const head = revisions[revisions.length - 1];
      if (head) {
        setDraft({
          title: head.title,
          promptText: head.promptText ?? '',
          text: head.text,
          rubricId: head.rubricId ?? '',
        });
      }
      setView('editor');
    } catch {
      setError('Could not open that draft.');
    }
  };

  const startNew = () => {
    setChain([]);
    setDraft({ title: '', promptText: '', text: '', rubricId: rubrics[0]?.rubricId ?? '' });
    setView('editor');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await essayService.saveEssay({
        title: draft.title.trim(),
        promptText: draft.promptText.trim() || undefined,
        text: draft.text,
        rubricId: draft.rubricId || undefined,
        // A graded draft is superseded, never overwritten — the before/after against the same
        // criteria is the point of the feature.
        parentSubmissionId: latest?.essaySubmissionId,
      });
      const saved = res.data?.data;
      await load();
      if (saved) await open(saved.essaySubmissionId);
    } catch {
      setError('Could not save that draft.');
    } finally {
      setBusy(false);
    }
  };

  const grade = async () => {
    if (!latest) return;
    setBusy(true);
    setError('');
    try {
      await essayService.grade(latest.essaySubmissionId);
      await open(latest.essaySubmissionId);
      await load();
    } catch {
      setError('Could not mark that draft. Check a rubric is selected and saved.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {!!error && <Text style={styles.error}>{error}</Text>}

        {view === 'list' && (
          <>
            <View style={styles.headerRow}>
              <Pressable onPress={() => setView('rubrics')} style={styles.linkButton}>
                <Text style={styles.linkText}>Rubrics</Text>
              </Pressable>
              <Pressable onPress={startNew} style={styles.primaryButton}>
                <Plus size={15} color={Colors.white} />
                <Text style={styles.primaryText}>New draft</Text>
              </Pressable>
            </View>

            {essays.length === 0 ? (
              <View style={styles.empty}>
                <PenLine size={30} color={Colors.textSecondary} />
                <Text style={styles.emptyTitle}>No drafts yet</Text>
                <Text style={styles.caption}>
                  Write or paste a draft, pick a rubric, and get scored feedback that quotes your own
                  text back to you.
                </Text>
              </View>
            ) : (
              essays.map((e) => (
                <Pressable key={e.essaySubmissionId} onPress={() => open(e.essaySubmissionId)}>
                  <Card style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{e.title}</Text>
                      <Text style={styles.caption}>
                        Draft {e.version} · {e.wordCount} words
                        {e.rubricName ? ` · ${e.rubricName}` : ''}
                        {!e.gradedAt ? ' · not yet marked' : ''}
                      </Text>
                    </View>
                    {e.scorePercent !== undefined && (
                      <Text style={styles.score}>{e.scorePercent}%</Text>
                    )}
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}

        {view === 'editor' && (
          <>
            <Pressable onPress={() => setView('list')} style={styles.backRow}>
              <ArrowLeft size={16} color={Colors.textSecondary} />
              <Text style={styles.caption}>All drafts</Text>
            </Pressable>

            <TextInput
              value={draft.title}
              onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
              placeholder="Title"
              placeholderTextColor={Colors.textSecondary}
              style={styles.input}
            />

            <TextInput
              value={draft.promptText}
              onChangeText={(v) => setDraft((d) => ({ ...d, promptText: v }))}
              placeholder="The question or task (optional — but it makes marking far more accurate)"
              placeholderTextColor={Colors.textSecondary}
              multiline
              style={[styles.input, styles.multiline]}
            />

            <View style={styles.rubricPicker}>
              {rubrics.map((r) => (
                <Pressable
                  key={r.rubricId}
                  onPress={() => setDraft((d) => ({ ...d, rubricId: r.rubricId }))}
                  style={[styles.chip, draft.rubricId === r.rubricId && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, draft.rubricId === r.rubricId && styles.chipTextActive]}
                  >
                    {r.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={draft.text}
              onChangeText={(v) => setDraft((d) => ({ ...d, text: v }))}
              placeholder="Write or paste your draft here…"
              placeholderTextColor={Colors.textSecondary}
              multiline
              style={[styles.input, styles.essayInput]}
            />

            <Text style={styles.caption}>
              {draft.text.split(/\s+/).filter(Boolean).length} words
              {latest ? ` · saving creates draft ${latest.version + 1}` : ''}
            </Text>

            <View style={styles.editorActions}>
              <Button
                title={busy ? 'Saving…' : 'Save draft'}
                variant="secondary"
                onPress={save}
                disabled={busy || !draft.title.trim() || !draft.text.trim()}
              />
              <Button
                title={busy ? 'Marking…' : 'Mark this draft'}
                onPress={grade}
                disabled={busy || !latest || !latest.rubricId}
              />
            </View>

            {chain.length > 1 && (
              <View style={styles.revisions}>
                {chain.map((rev) => (
                  <Text key={rev.essaySubmissionId} style={styles.revisionChip}>
                    Draft {rev.version}
                    {rev.scorePercent !== undefined ? ` · ${rev.scorePercent}%` : ''}
                  </Text>
                ))}
              </View>
            )}

            {latest?.feedback ? (
              <EssayFeedbackPanel feedback={latest.feedback} scorePercent={latest.scorePercent} />
            ) : (
              <Text style={styles.caption}>
                Save the draft with a rubric selected, then mark it to see scored feedback here.
              </Text>
            )}
          </>
        )}

        {view === 'rubrics' && (
          <RubricManager
            rubrics={rubrics}
            onBack={() => setView('list')}
            onChanged={load}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const RubricManager: React.FC<{
  rubrics: Rubric[];
  onBack: () => void;
  onChanged: () => Promise<void>;
}> = ({ rubrics, onBack, onChanged }) => {
  const [name, setName] = useState('');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([{ name: '', maxPoints: 10 }]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const valid = criteria.filter((c) => c.name.trim() && c.maxPoints > 0);
    if (!name.trim() || valid.length === 0) return;

    setBusy(true);
    try {
      await essayService.saveRubric({ name: name.trim(), criteria: valid });
      setName('');
      setCriteria([{ name: '', maxPoints: 10 }]);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable onPress={onBack} style={styles.backRow}>
        <ArrowLeft size={16} color={Colors.textSecondary} />
        <Text style={styles.caption}>Back to drafts</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>New rubric</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Rubric name, e.g. Argumentative essay"
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
      />

      {criteria.map((c, i) => (
        <View key={i} style={styles.criterionRow}>
          <TextInput
            value={c.name}
            onChangeText={(v) =>
              setCriteria((cs) => cs.map((x, idx) => (idx === i ? { ...x, name: v } : x)))
            }
            placeholder="Criterion, e.g. Use of evidence"
            placeholderTextColor={Colors.textSecondary}
            style={[styles.input, styles.flex]}
          />
          <TextInput
            value={String(c.maxPoints)}
            onChangeText={(v) =>
              setCriteria((cs) =>
                cs.map((x, idx) => (idx === i ? { ...x, maxPoints: Number(v) || 0 } : x)),
              )
            }
            keyboardType="number-pad"
            style={[styles.input, styles.pointsInput]}
          />
        </View>
      ))}

      <Pressable
        onPress={() => setCriteria((cs) => [...cs, { name: '', maxPoints: 10 }])}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>+ Add criterion</Text>
      </Pressable>

      <Button title={busy ? 'Saving…' : 'Save rubric'} onPress={save} disabled={busy || !name.trim()} />

      <Text style={styles.sectionLabel}>Your rubrics</Text>
      {rubrics.length === 0 ? (
        <Text style={styles.caption}>None yet.</Text>
      ) : (
        rubrics.map((r) => (
          <Card key={r.rubricId} style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{r.name}</Text>
              <Text style={styles.caption}>
                {r.criteria.map((c) => `${c.name} (${c.maxPoints})`).join(' · ')}
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                await essayService.deleteRubric(r.rubricId);
                await onChanged();
              }}
              hitSlop={8}
            >
              <Trash2 size={16} color={Colors.textSecondary} />
            </Pressable>
          </Card>
        ))
      )}
    </>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  error: { ...Typography.caption, color: Colors.red },
  score: { ...Typography.subheading, color: Colors.textSecondary },
  sectionLabel: {
    ...Typography.captionBold, color: Colors.textSecondary,
    textTransform: 'uppercase', marginTop: Spacing.two,
  },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyTitle: { ...Typography.subheading, color: Colors.textPrimary },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: Spacing.two,
    color: Colors.textPrimary, backgroundColor: Colors.bgSidebar,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  essayInput: { minHeight: 240, textAlignVertical: 'top', lineHeight: 22 },
  pointsInput: { width: 72, textAlign: 'center' },
  criterionRow: { flexDirection: 'row', gap: Spacing.two },
  rubricPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    paddingHorizontal: Spacing.two, paddingVertical: 6,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.caption, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  editorActions: { flexDirection: 'row', gap: Spacing.two },
  revisions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  revisionChip: {
    ...Typography.caption, color: Colors.textSecondary,
    paddingHorizontal: Spacing.two, paddingVertical: 4,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
  },
  linkButton: { paddingVertical: Spacing.one },
  linkText: { ...Typography.bodyBold, color: Colors.primary },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: Radius.md, backgroundColor: Colors.primary,
  },
  primaryText: { ...Typography.bodyBold, color: Colors.white },
});

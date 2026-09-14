import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, PenLine, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEssays } from '../../hooks/useEssays';
import EssayFeedbackPanel from '../../components/essays/EssayFeedbackPanel';
import type { RubricCriterion } from '../../services/essayService';

type View = 'list' | 'editor' | 'rubrics';

const blankCriterion = (): RubricCriterion => ({ name: '', description: '', maxPoints: 10 });

export const EssaysTab: React.FC = () => {
  const {
    essays, rubrics, chain, loading, grading, error,
    latestDraft, openEssay, closeEssay, saveDraft, grade, saveRubric, deleteRubric,
  } = useEssays();

  const [view, setView] = useState<View>('list');
  const [draft, setDraft] = useState({ title: '', promptText: '', text: '', rubricId: '' });
  const [saving, setSaving] = useState(false);

  // When a draft is opened, seed the editor from the newest revision so "Save" continues the chain
  // rather than silently starting a new essay.
  useEffect(() => {
    if (latestDraft && view === 'editor') {
      setDraft({
        title: latestDraft.title,
        promptText: latestDraft.promptText ?? '',
        text: latestDraft.text,
        rubricId: latestDraft.rubricId ?? '',
      });
    }
  }, [latestDraft, view]);

  const startNew = () => {
    closeEssay();
    setDraft({ title: '', promptText: '', text: '', rubricId: rubrics[0]?.rubricId ?? '' });
    setView('editor');
  };

  const open = async (id: string) => {
    await openEssay(id);
    setView('editor');
  };

  const submit = async () => {
    if (!draft.title.trim() || !draft.text.trim()) return;
    setSaving(true);
    try {
      await saveDraft({
        title: draft.title.trim(),
        promptText: draft.promptText.trim() || undefined,
        text: draft.text,
        rubricId: draft.rubricId || undefined,
        // A graded draft is superseded, never overwritten.
        parentSubmissionId: latestDraft?.essaySubmissionId,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => setView(view === 'rubrics' ? 'list' : 'rubrics')}
          className="px-4 py-2 rounded-lg border border-border hover:bg-surface-hover text-sm"
        >
          {view === 'rubrics' ? 'Back to drafts' : 'Rubrics'}
        </button>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm"
        >
          <Plus className="w-4 h-4" /> New draft
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {view === 'rubrics' && <RubricManager rubrics={rubrics} onSave={saveRubric} onDelete={deleteRubric} />}

      {view === 'list' &&
        (loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : essays.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-border">
            <PenLine className="w-10 h-10 text-text-muted mx-auto" />
            <h2 className="mt-4 font-semibold text-text-main">No drafts yet</h2>
            <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
              Write or paste a draft, pick a rubric, and get scored feedback that quotes your own text.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {essays.map((e) => (
              <button
                key={e.essaySubmissionId}
                onClick={() => void open(e.essaySubmissionId)}
                className="text-left p-4 rounded-xl border border-border bg-surface hover:border-teal-500 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-text-main">{e.title}</span>
                  {e.scorePercent !== undefined && (
                    <span className="text-sm text-text-muted shrink-0">{e.scorePercent}%</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Draft {e.version} · {e.wordCount} words
                  {e.rubricName && ` · ${e.rubricName}`}
                  {!e.gradedAt && ' · not yet marked'}
                </p>
              </button>
            ))}
          </div>
        ))}

      {view === 'editor' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <button
              onClick={() => {
                closeEssay();
                setView('list');
              }}
              className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-main"
            >
              <ArrowLeft className="w-4 h-4" /> All drafts
            </button>

            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
            />

            <textarea
              value={draft.promptText}
              onChange={(e) => setDraft((d) => ({ ...d, promptText: e.target.value }))}
              placeholder="The question or task (optional, but it makes marking far more accurate)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm"
            />

            <select
              value={draft.rubricId}
              onChange={(e) => setDraft((d) => ({ ...d, rubricId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm"
            >
              <option value="">No rubric — save only</option>
              {rubrics.map((r) => (
                <option key={r.rubricId} value={r.rubricId}>
                  {r.name} ({r.totalPoints} pts)
                </option>
              ))}
            </select>

            <textarea
              value={draft.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              placeholder="Write or paste your draft here…"
              rows={18}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface font-serif leading-relaxed"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-muted">
                {draft.text.split(/\s+/).filter(Boolean).length} words
                {latestDraft && ` · saving creates draft ${latestDraft.version + 1}`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => void submit()}
                  disabled={saving || !draft.title.trim() || !draft.text.trim()}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-surface-hover text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  onClick={() => latestDraft && void grade(latestDraft.essaySubmissionId)}
                  disabled={grading || !latestDraft || !latestDraft.rubricId}
                  title={!latestDraft?.rubricId ? 'Pick a rubric and save first' : undefined}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm disabled:opacity-50"
                >
                  {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Mark this draft
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {chain.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {chain.map((rev) => (
                  <span
                    key={rev.essaySubmissionId}
                    className="px-2 py-1 rounded-lg border border-border text-xs text-text-muted"
                  >
                    Draft {rev.version}
                    {rev.scorePercent !== undefined && ` · ${rev.scorePercent}%`}
                  </span>
                ))}
              </div>
            )}

            {latestDraft?.feedback ? (
              <EssayFeedbackPanel feedback={latestDraft.feedback} scorePercent={latestDraft.scorePercent} />
            ) : (
              <p className="text-sm text-text-muted">
                Save the draft with a rubric selected, then mark it to see scored feedback here.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RubricManager: React.FC<{
  rubrics: ReturnType<typeof useEssays>['rubrics'];
  onSave: ReturnType<typeof useEssays>['saveRubric'];
  onDelete: ReturnType<typeof useEssays>['deleteRubric'];
}> = ({ rubrics, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([blankCriterion()]);
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<RubricCriterion>) =>
    setCriteria((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const submit = async () => {
    const valid = criteria.filter((c) => c.name.trim() && c.maxPoints > 0);
    if (!name.trim() || valid.length === 0) return;

    setBusy(true);
    try {
      if (await onSave({ name: name.trim(), criteria: valid })) {
        setName('');
        setCriteria([blankCriterion()]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">New rubric</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rubric name, e.g. Argumentative essay"
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
        />

        {criteria.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Criterion, e.g. Use of evidence"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-sm"
            />
            <input
              type="number"
              min={1}
              value={c.maxPoints}
              onChange={(e) => update(i, { maxPoints: Number(e.target.value) })}
              className="w-20 px-3 py-2 rounded-lg border border-border bg-surface text-sm"
            />
          </div>
        ))}

        <div className="flex justify-between">
          <button
            onClick={() => setCriteria((cs) => [...cs, blankCriterion()])}
            className="text-sm text-teal-600 hover:text-teal-700"
          >
            + Add criterion
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save rubric'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Your rubrics</h2>
        {rubrics.length === 0 ? (
          <p className="text-sm text-text-muted">None yet.</p>
        ) : (
          rubrics.map((r) => (
            <div key={r.rubricId} className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-main text-sm">{r.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {r.criteria.map((c) => `${c.name} (${c.maxPoints})`).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => void onDelete(r.rubricId)}
                className="text-text-muted hover:text-red-600"
                aria-label={`Delete ${r.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EssaysTab;

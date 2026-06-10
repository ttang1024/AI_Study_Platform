import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Swords, Plus, Play, Loader2, CheckCircle2, XCircle, ArrowLeft, Timer } from 'lucide-react';
import studyGroupService, {
  type Battle, type BattlePlay, type BattleResult,
} from '../../services/studyGroupService';
import { useStudy } from '../../context/StudyContext';
import { Select } from '../common/Select';
import { cn } from '../../utils/cn';

const BattleRunner: React.FC<{
  play: BattlePlay;
  onBack: () => void;
  onFinished: () => void;
}> = ({ play, onBack, onFinished }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<BattleResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [result]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await studyGroupService.submitBattleEntry(
        play.battle.id, answers, Math.floor((Date.now() - startRef.current) / 1000));
      setResult(res.data?.data ?? null);
      onFinished();
    } catch { /* keep runner open so answers aren't lost */ } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="text-center py-3">
          <p className="text-2xl font-black text-text-main">{result.score} / {result.total}</p>
          <p className="text-xs text-gray-400 mt-1">Standings update as others play.</p>
          <button onClick={onBack} className="mt-3 text-xs font-medium border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">
            Back to battles
          </button>
        </div>
        {result.items.map((item) => (
          <div key={item.questionId} className={cn('border rounded-xl p-3', item.correct ? 'border-green-200' : 'border-red-200')}>
            <div className="flex items-start gap-2">
              {item.correct
                ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-sm text-text-main">{item.question}</p>
                {!item.correct && (
                  <p className="text-[11px] text-red-500 mt-1">Correct: {item.correctAnswer}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <button onClick={onBack} className="p-1 text-gray-400 hover:text-gray-600"><ArrowLeft size={15} /></button>
        <span className="text-sm font-semibold text-gray-700 truncate flex-1">{play.battle.title}</span>
        <Timer size={13} className="text-gray-400" />
        <span className="font-mono text-xs text-gray-500">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length === 0}
          className="inline-flex items-center gap-1 bg-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={11} className="animate-spin" />} Submit
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {play.questions.map((q, i) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-text-main mb-2">{i + 1}. {q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  className={cn(
                    'w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors',
                    answers[q.id] === opt
                      ? 'border-teal-400 bg-teal-50 text-teal-800'
                      : 'border-gray-200 hover:border-teal-200 text-gray-700',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const GroupBattles: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { courses } = useStudy();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [count, setCount] = useState(5);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [playing, setPlaying] = useState<BattlePlay | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(() => {
    studyGroupService.getBattles(groupId)
      .then((res) => setBattles(res.data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      await studyGroupService.createBattle(groupId, {
        title: title.trim(),
        courseId: courseId || undefined,
        count,
      });
      setShowCreate(false);
      setTitle('');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setCreateError(err?.response?.data?.message ?? 'Failed to create battle.');
    } finally {
      setCreating(false);
    }
  };

  const handlePlay = async (battle: Battle) => {
    setOpeningId(battle.id);
    try {
      const res = await studyGroupService.getBattle(battle.id);
      setPlaying(res.data?.data ?? null);
    } catch { /* battle list stays visible */ } finally {
      setOpeningId(null);
    }
  };

  if (playing) {
    return <BattleRunner play={playing} onBack={() => setPlaying(null)} onFinished={load} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <Swords size={15} className="text-purple-500" />
        <h2 className="text-sm font-semibold text-gray-700">Quiz battles</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="ml-auto p-1.5 rounded-lg text-teal-600 hover:bg-teal-50"
          title="New battle"
        >
          <Plus size={15} />
        </button>
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Battle title (optional)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          <div className="flex items-center gap-2">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} size="xs" className="flex-1">
              <option value="">Any of my courses</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))} size="xs" className="w-24">
              {[3, 5, 10, 15].map((n) => <option key={n} value={n}>{n} Qs</option>)}
            </Select>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-teal-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
          {createError && <p className="text-xs text-red-500">{createError}</p>}
          <p className="text-[10px] text-gray-400">Questions are snapshotted from your quiz bank — everyone answers the same set.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
          </div>
        ) : battles.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">
            No battles yet — challenge your group with questions from your quiz bank.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {battles.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">{b.title}</p>
                    <p className="text-[11px] text-gray-400">
                      {b.questionCount} questions · {b.entries.length} played · {new Date(b.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {b.iHavePlayed ? (
                    <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg">Played</span>
                  ) : (
                    <button
                      onClick={() => handlePlay(b)}
                      disabled={openingId === b.id}
                      className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {openingId === b.id ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Play
                    </button>
                  )}
                </div>
                {b.entries.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {b.entries.slice(0, 5).map((e) => (
                      <li key={e.userId} className={cn('flex items-center gap-2 text-xs', e.isMe ? 'text-teal-700 font-medium' : 'text-gray-500')}>
                        <span className="w-4 text-center font-bold">{e.rank}</span>
                        <span className="flex-1 truncate">{e.name}</span>
                        <span>{e.score}/{e.total}</span>
                        <span className="text-gray-400">{Math.floor(e.durationSeconds / 60)}:{String(e.durationSeconds % 60).padStart(2, '0')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

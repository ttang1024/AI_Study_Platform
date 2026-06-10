import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic, MicOff, Loader2, Sparkles, CheckCircle2, AlertTriangle, Lightbulb,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { glossaryService } from '../../services/glossaryService';
import { ChatMarkdown } from '../ai/ChatMarkdown';
import { useDictation } from './useDictation';
import type { GlossaryTerm } from '../../types';
import { cn } from '../../utils/cn';

interface Evaluation {
  score: number;
  strengths: string[];
  gaps: string[];
  suggestion: string;
}

/** Feynman teach-back: explain a glossary concept in your own words; the AI grades it. */
export const TeachBackMode: React.FC = () => {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GlossaryTerm | null>(null);
  const [explanation, setExplanation] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');

  const { listening, toggle, supported } = useDictation((text) => setExplanation(text));

  useEffect(() => {
    glossaryService.getAllGlossary().then(setTerms).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? terms.filter((t) => t.term.toLowerCase().includes(q)) : terms;
    return list.slice(0, 30);
  }, [terms, search]);

  const handleEvaluate = async () => {
    if (!selected || explanation.trim().length < 20) return;
    setEvaluating(true);
    setError('');
    setEvaluation(null);
    try {
      const res = await apiClient.post('/api/ai/evaluate-explanation', {
        topic: selected.term,
        reference: selected.definition,
        explanation: explanation.trim(),
      });
      setEvaluation(res.data.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Evaluation failed. Try again.');
    } finally {
      setEvaluating(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Concept picker */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 520 }}>
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Pick a concept</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your glossary…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>
        <ul className="divide-y divide-gray-50 overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-4 text-xs text-gray-400">
              No glossary terms yet — generate a glossary from your materials first.
            </li>
          ) : filtered.map((t) => (
            <li
              key={t.id}
              onClick={() => { setSelected(t); setEvaluation(null); setExplanation(''); }}
              className={cn(
                'px-4 py-2.5 cursor-pointer text-sm transition-colors',
                selected?.id === t.id ? 'bg-teal-50/70 text-teal-800 font-medium' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              {t.term}
            </li>
          ))}
        </ul>
      </div>

      {/* Explanation + result */}
      <div className="lg:col-span-2 space-y-4">
        {!selected ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
            The Feynman technique: pick a concept and explain it in your own words, as if
            teaching a friend. The AI grades your explanation against your source material.
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Explain in your own words:</p>
              <h3 className="text-base font-bold text-text-main">{selected.term}</h3>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={6}
                placeholder="Imagine teaching this to a friend who's never heard of it…"
                className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 resize-y"
              />
              <div className="mt-2 flex items-center gap-2">
                {supported && (
                  <button
                    onClick={toggle}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors',
                      listening
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {listening ? <MicOff size={13} /> : <Mic size={13} />}
                    {listening ? 'Stop dictation' : 'Dictate'}
                  </button>
                )}
                <span className="text-[11px] text-gray-400">{explanation.trim().length} chars (min 20)</span>
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating || explanation.trim().length < 20}
                  className="ml-auto inline-flex items-center gap-1.5 bg-teal-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {evaluating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Grade my explanation
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            </div>

            {evaluation && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className={cn('text-3xl font-black', scoreColor(evaluation.score))}>
                    {evaluation.score}
                  </span>
                  <span className="text-sm text-gray-500">/ 100 understanding score</span>
                </div>
                {evaluation.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 flex items-center gap-1 mb-1">
                      <CheckCircle2 size={12} /> What you nailed
                    </p>
                    <ul className="space-y-1">
                      {evaluation.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-1.5"><span>•</span><span className="min-w-0"><ChatMarkdown>{s}</ChatMarkdown></span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {evaluation.gaps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-1">
                      <AlertTriangle size={12} /> Gaps in your explanation
                    </p>
                    <ul className="space-y-1">
                      {evaluation.gaps.map((g, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-1.5"><span>•</span><span className="min-w-0"><ChatMarkdown>{g}</ChatMarkdown></span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {evaluation.suggestion && (
                  <div className="bg-teal-50/70 rounded-lg p-3">
                    <p className="text-xs font-semibold text-teal-700 flex items-center gap-1 mb-1">
                      <Lightbulb size={12} /> Next step
                    </p>
                    <div className="text-sm text-teal-900"><ChatMarkdown>{evaluation.suggestion}</ChatMarkdown></div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

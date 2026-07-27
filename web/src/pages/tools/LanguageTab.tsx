import React, { useState } from 'react';
import { Check, Loader2, Mic, Square, X } from 'lucide-react';
import { usePronunciationPractice } from '../../hooks/usePronunciationPractice';
import { apiClient } from '../../services/apiClient';
import { getApiErrorMessage } from '../../utils/apiError';

type Mode = 'speak' | 'mine';

export const LanguageTab: React.FC = () => {
  const [mode, setMode] = useState<Mode>('speak');

  return (
    <div className="space-y-5">
      {/* Sub-modes rather than top-level tabs: both are "language", and the page already spends its
          top row on the tool tabs. */}
      <div className="inline-flex gap-1 rounded-xl border border-[var(--border-color)] p-1">
        {(['speak', 'mine'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              mode === m
                ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {m === 'speak' ? 'Pronunciation' : 'Sentence mining'}
          </button>
        ))}
      </div>

      {mode === 'speak' ? <PronunciationPractice /> : <SentenceMining />}
    </div>
  );
};

const PronunciationPractice: React.FC = () => {
  const { recording, scoring, result, error, start, stopAndScore } = usePronunciationPractice();
  const [phrase, setPhrase] = useState('');

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-main mb-1.5">Phrase to say</label>
        <input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="e.g. Where is the train station?"
          className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]"
        />
      </div>

      <div className="flex items-center gap-3">
        {recording ? (
          <button
            onClick={() => stopAndScore(phrase)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
          >
            <Square className="w-4 h-4" /> Stop and check
          </button>
        ) : (
          <button
            onClick={() => void start()}
            disabled={!phrase.trim() || scoring}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 text-sm disabled:opacity-50"
          >
            {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {scoring ? 'Checking…' : 'Record'}
          </button>
        )}
        {recording && <span className="text-sm text-text-muted">Listening…</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-xl border border-[var(--border-color)] p-4 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-main">{result.score}%</span>
            <span className="text-sm text-text-muted">of the words came through clearly</span>
          </div>

          {/* Per-word marks are the actionable part: a single number tells a learner nothing about
              which syllable to work on. */}
          <p className="flex flex-wrap gap-1.5">
            {result.words.map((w, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm ${
                  w.correct
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                }`}
              >
                {w.correct ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {w.word}
              </span>
            ))}
          </p>

          <p className="text-xs text-text-muted">
            Heard: “{result.heard || '—'}”. This checks whether a speech recogniser made out the right
            words, which is a useful proxy for intelligibility — not a judgement of your accent.
          </p>
        </div>
      )}
    </div>
  );
};

const SentenceMining: React.FC = () => {
  const [sentence, setSentence] = useState('');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiClient.post('/api/language/mine', {
        sentence,
        targetWord: word,
        meaning: meaning.trim() || undefined,
      });
      setMessage('Added to your reviews.');
      setSentence('');
      setWord('');
      setMeaning('');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create that card.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-text-muted">
        Paste a sentence you met and choose the word to learn. It becomes a cloze card in your normal
        review schedule, so you meet the word again in the sentence you found it in.
      </p>

      <textarea
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
        rows={3}
        placeholder="The sentence, exactly as you met it"
        className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Word to blank out"
          className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]"
        />
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="Meaning (optional)"
          className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <button
        onClick={() => void submit()}
        disabled={busy || !sentence.trim() || !word.trim()}
        className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 text-sm disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add card'}
      </button>
    </div>
  );
};

export default LanguageTab;

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, ArrowRight } from 'lucide-react';
import { cardStyle, type FeatureTheme } from '../theme';

const QUESTIONS = [
  {
    q: 'Which organelle produces most of the cell’s ATP?',
    options: ['Ribosome', 'Mitochondrion', 'Golgi apparatus', 'Nucleus'],
    answer: 1,
    why: 'Mitochondria run cellular respiration, which makes most of the cell’s ATP.',
  },
  {
    q: 'What does a p-value below 0.05 usually lead you to do?',
    options: ['Accept the null hypothesis', 'Collect more data', 'Reject the null hypothesis', 'Change the sample size'],
    answer: 2,
    why: 'Below the 0.05 threshold the result is called statistically significant, so the null hypothesis is rejected.',
  },
];

const LETTERS = ['A', 'B', 'C', 'D'];

export const QuizHero: React.FC<{ theme: FeatureTheme }> = ({ theme }) => {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const question = QUESTIONS[index];
  const answered = picked !== null;

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === question.answer) setScore((s) => s + 1);
  };

  const next = () => {
    setPicked(null);
    setIndex((i) => (i + 1) % QUESTIONS.length);
    if (index === QUESTIONS.length - 1) setScore(0);
  };

  const optionStyle = (i: number): React.CSSProperties => {
    if (!answered) return { background: '#f8fafc', border: `1px solid ${theme.line}` };
    if (i === question.answer) return { background: '#ecfdf5', border: '1px solid #10b981' };
    if (i === picked) return { background: '#fff1f2', border: '1px solid #f43f5e' };
    return { background: '#f8fafc', border: `1px solid ${theme.line}`, opacity: 0.55 };
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl p-5 sm:p-6"
      style={{ ...cardStyle(theme), boxShadow: '0 30px 60px -20px rgba(15,23,42,0.22)' }}>
      <div className="flex items-center justify-between text-xs font-semibold mb-3" style={{ color: theme.muted }}>
        <span>Question {index + 1} of {QUESTIONS.length}</span>
        <span className="px-2.5 py-1 rounded-full" style={{ background: theme.accentSoft, color: theme.accentText }}>Score {score}</span>
      </div>
      <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: theme.accentSoft }}>
        <motion.div className="h-full rounded-full" style={{ background: theme.ctaBackground }}
          animate={{ width: `${((index + (answered ? 1 : 0)) / QUESTIONS.length) * 100}%` }} />
      </div>

      <p className="text-lg font-bold leading-snug mb-4">{question.q}</p>

      <div className="grid gap-2.5">
        {question.options.map((option, i) => (
          <button key={option} type="button" onClick={() => pick(i)} disabled={answered}
            className="flex items-center gap-3 text-left text-sm font-medium rounded-xl px-3.5 py-3 transition-colors disabled:cursor-default"
            style={optionStyle(i)}>
            <span className="inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: theme.accentSoft, color: theme.accentText }}>
              {answered && i === question.answer ? <Check className="w-4 h-4" /> : answered && i === picked ? <X className="w-4 h-4" /> : LETTERS[i]}
            </span>
            {option}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <p className="text-sm leading-relaxed mt-4" style={{ color: theme.muted }}>
              <strong style={{ color: picked === question.answer ? '#059669' : '#e11d48' }}>
                {picked === question.answer ? 'Correct. ' : 'Not quite. '}
              </strong>
              {question.why}
            </p>
            <button type="button" onClick={next}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full text-white"
              style={{ background: theme.ctaBackground }}>
              Next question <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

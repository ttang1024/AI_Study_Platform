import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Loader2, Sparkles, Eye, EyeOff, CheckCircle2, XCircle, Send, AlertCircle, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { workedProblemsService, WorkedProblem, ProblemAttempt } from '../services/workedProblemsService';
import { cn } from '../utils/cn';
import { getApiErrorCode } from '../utils/apiError';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const COUNTS = [3, 5, 10] as const;

interface ProblemCardProps {
  problem: WorkedProblem;
}

const ProblemCard: React.FC<ProblemCardProps> = ({ problem }) => {
  const [expanded, setExpanded] = useState(false);
  const [revealedSteps, setRevealedSteps] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [attempt, setAttempt] = useState<ProblemAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!userAnswer.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await workedProblemsService.submitAttempt(problem.workedProblemId, userAnswer);
      setAttempt(result);
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyColor = {
    easy: 'text-green-500 bg-green-50',
    medium: 'text-orange-500 bg-orange-50',
    hard: 'text-red-500 bg-red-50',
  }[problem.difficulty] ?? 'text-zinc-500 bg-zinc-50';

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between p-4 text-left hover:bg-[var(--bg-app)] transition-colors"
      >
        <div className="flex-1 min-w-0 pr-3">
          {problem.topic && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{problem.topic}</span>
          )}
          <p className="text-sm font-medium text-text-main mt-0.5 leading-snug">{problem.problemText}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', difficultyColor)}>
            {problem.difficulty}
          </span>
          {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-color)]">
              {/* Steps */}
              {problem.steps.length > 0 && (
                <div className="space-y-2 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Solution Steps</p>
                  {problem.steps.slice(0, revealedSteps).map(step => (
                    <div key={step.stepNumber} className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {step.stepNumber}
                      </span>
                      <div>
                        <p className="text-sm text-text-main">{step.description}</p>
                        {step.formula && (
                          <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded mt-1 block font-mono">
                            {step.formula}
                          </code>
                        )}
                      </div>
                    </div>
                  ))}
                  {revealedSteps < problem.steps.length && (
                    <button
                      onClick={() => setRevealedSteps(s => s + 1)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Show Step {revealedSteps + 1}
                    </button>
                  )}
                </div>
              )}

              {/* Final Answer toggle */}
              <div>
                <button
                  onClick={() => setShowAnswer(s => !s)}
                  className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main transition-colors"
                >
                  {showAnswer ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showAnswer ? 'Hide Answer' : 'Show Final Answer'}
                </button>
                {showAnswer && (
                  <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 prose prose-sm prose-green max-w-none text-green-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{problem.finalAnswer}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* User answer area */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Your Answer</p>
                <textarea
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  disabled={attempt !== null}
                  placeholder="Type your answer here..."
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm text-text-main placeholder:text-text-muted resize-none focus:outline-none focus:border-primary disabled:opacity-60"
                />
                {!attempt && (
                  <button
                    onClick={handleSubmit}
                    disabled={!userAnswer.trim() || isSubmitting}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Check Answer
                  </button>
                )}
              </div>

              {/* AI Evaluation */}
              {attempt && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-xl p-3 space-y-1',
                    attempt.isCorrect
                      ? 'bg-green-50 border border-green-200'
                      : attempt.isCorrect === false
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-blue-50 border border-blue-200'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {attempt.isCorrect === true && <CheckCircle2 size={14} className="text-green-600" />}
                    {attempt.isCorrect === false && <XCircle size={14} className="text-red-600" />}
                    <span className={cn(
                      'text-xs font-bold',
                      attempt.isCorrect === true ? 'text-green-700' : attempt.isCorrect === false ? 'text-red-700' : 'text-blue-700'
                    )}>
                      {attempt.isCorrect === true ? 'Correct!' : attempt.isCorrect === false ? 'Not quite right' : 'AI Feedback'}
                    </span>
                  </div>
                  {attempt.aiEvaluation && (
                    <p className="text-xs text-text-main leading-relaxed">{attempt.aiEvaluation}</p>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface WorkedProblemsPanelProps {
  documentId?: string;
  videoId?: string;
  generateDisabled?: boolean;
  generateDisabledReason?: string;
}

export const WorkedProblemsPanel: React.FC<WorkedProblemsPanelProps> = ({ documentId, videoId, generateDisabled = false, generateDisabledReason }) => {
  const [problems, setProblems] = useState<WorkedProblem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>('medium');
  const [count, setCount] = useState<typeof COUNTS[number]>(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const fetch = videoId
      ? workedProblemsService.getVideoProblems(videoId)
      : workedProblemsService.getProblems(documentId!);
    fetch
      .then(setProblems)
      .catch(err => setError(getApiErrorCode(err)))
      .finally(() => setIsLoading(false));
  }, [documentId, videoId]);

  const handleGenerate = useCallback(async () => {
    if (generateDisabled) return;
    setIsGenerating(true);
    setError(null);
    try {
      const generated = videoId
        ? await workedProblemsService.generateVideoProblems(videoId, difficulty, count)
        : await workedProblemsService.generateProblems(documentId!, difficulty, count);
      setProblems(generated);
    } catch (err) {
      setError(getApiErrorCode(err));
    } finally {
      setIsGenerating(false);
    }
  }, [documentId, videoId, difficulty, count, generateDisabled]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Generate controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={difficulty}
          onChange={e => setDifficulty(e.target.value as typeof DIFFICULTIES[number])}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-1.5 text-xs font-medium text-text-main focus:outline-none focus:border-primary"
        >
          {DIFFICULTIES.map(d => (
            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
          ))}
        </select>
        <select
          value={count}
          onChange={e => setCount(Number(e.target.value) as typeof COUNTS[number])}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-1.5 text-xs font-medium text-text-main focus:outline-none focus:border-primary"
        >
          {COUNTS.map(c => (
            <option key={c} value={c}>{c} problems</option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || generateDisabled}
          title={generateDisabled ? generateDisabledReason : undefined}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : error ? <RotateCcw size={12} /> : <Sparkles size={12} />}
          {error ? 'Retry' : problems.length > 0 ? 'Regenerate' : 'Generate Problems'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Problems list */}
      {problems.length === 0 && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Sparkles size={28} className="text-zinc-300" />
          <p className="text-sm font-medium text-text-muted">No worked problems yet.</p>
          <p className="text-xs text-text-muted">Generate step-by-step problems from this document.</p>
        </div>
      )}

      <div className="space-y-3">
        {problems.map(problem => (
          <ProblemCard key={problem.workedProblemId} problem={problem} />
        ))}
      </div>
    </div>
  );
};

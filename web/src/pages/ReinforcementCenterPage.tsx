import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  XCircle, BookMarked, BrainCircuit,
  Loader2, ChevronRight, Play,
} from 'lucide-react';
import { Flashcard, GlossaryTerm, QuizQuestion } from '../types';
import { flashcardService } from '../services/flashcardService';
import { glossaryService } from '../services/glossaryService';
import { masteredService } from '../services/masteredService';
import { questionBankService, QuestionBankQuestion } from '../services/questionBankService';
import { documentService, quizSubmissionService, QuizSubmission } from '../services/documentService';
import { youtubeService } from '../services/youtubeService';
import { isQuizOptionCorrect } from '../utils/quizAnswers';
import { TimedExamModal } from '../components/quiz/TimedExamModal';
import { HardFlashcardReview } from '../components/study/HardFlashcardCard';
import { SessionRating } from '../components/study/FlashcardSessionCard';
import { QuizMistakeCard } from '../components/quiz/QuizMistakeCard';
import { GlossaryTermCard } from '../components/common/GlossaryTermCard';

type ActiveModule = 'quiz' | 'glossary' | 'flashcards';

interface FailedQuestion {
  question: QuestionBankQuestion;
  selectedAnswer: string;
  sourceName: string;
}

const toQuizQuestion = (q: QuestionBankQuestion): QuizQuestion => ({
  id: q.quizId,
  question: q.question,
  options: q.options,
  answer: q.correctAnswer,
  explanation: q.explanation,
  type: 'multiple-choice',
  difficulty: q.difficulty,
});

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getAllQuizSubmissions = async (): Promise<QuizSubmission[]> => {
  const firstPage = await quizSubmissionService.getAllSubmissions(1, 200);
  if (firstPage.totalCount <= firstPage.items.length) return firstPage.items;
  const fullPage = await quizSubmissionService.getAllSubmissions(1, firstPage.totalCount);
  return fullPage.items;
};

const isVideoSubmission = (submission: QuizSubmission) =>
  Boolean(submission.youTubeVideoId || submission.sourceType === 'video');

const isQuestionFromSubmissionSource = (question: QuestionBankQuestion, submission: QuizSubmission) => {
  if (isVideoSubmission(submission)) {
    return question.sourceType === 'video' && question.youTubeVideoId === submission.youTubeVideoId;
  }
  return question.sourceType === 'document' && question.documentId === submission.documentId;
};

const getAnsweredQuestionsForSubmission = (
  submission: QuizSubmission,
  bankQuestions: QuestionBankQuestion[],
  byId: Map<string, QuestionBankQuestion>,
) => {
  const answerIds = Object.keys(submission.answers ?? {});
  const answeredQuestionIds = new Set(answerIds);
  const sourceQuestions = bankQuestions.filter(question => isQuestionFromSubmissionSource(question, submission));
  const candidates = sourceQuestions.length > 0
    ? sourceQuestions
    : answerIds
      .map(id => byId.get(id))
      .filter((question): question is QuestionBankQuestion => Boolean(question));

  return candidates.filter(question => answeredQuestionIds.has(question.quizId));
};

export const ReinforcementCenterPage: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const navigate = useNavigate();

  const [activeModule, setActiveModule] = useState<ActiveModule>('quiz');

  const [bankQuestions, setBankQuestions] = useState<QuestionBankQuestion[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [quizLoading, setQuizLoading] = useState(true);

  const [allTerms, setAllTerms] = useState<GlossaryTerm[]>([]);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => masteredService.getCached(userId));
  const [glossaryLoading, setGlossaryLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [hardCards, setHardCards] = useState<Flashcard[]>([]);
  const [flashcardQueue, setFlashcardQueue] = useState<Flashcard[]>([]);
  const [flashcardLoading, setFlashcardLoading] = useState(true);

  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);
  const [practiceCorrectIds, setPracticeCorrectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setQuizLoading(true);
    Promise.all([
      questionBankService.getQuestions(),
      getAllQuizSubmissions(),
    ])
      .then(([questions, subs]) => {
        setBankQuestions(questions);
        setSubmissions(subs);
      })
      .catch(() => { })
      .finally(() => setQuizLoading(false));
  }, []);

  useEffect(() => {
    setGlossaryLoading(true);
    Promise.all([
      glossaryService.getAllGlossary(),
      masteredService.loadFromServer(userId),
    ])
      .then(([terms, ids]) => {
        setAllTerms(terms);
        setMasteredIds(ids);
      })
      .catch(() => { })
      .finally(() => setGlossaryLoading(false));
  }, [userId]);

  useEffect(() => {
    setFlashcardLoading(true);
    flashcardService.getAllFlashcards(1, 500)
      .then(data => {
        const cards = data.items.filter(c => c.difficulty === 'hard');
        setHardCards(cards);
        setFlashcardQueue(cards);
      })
      .catch(() => { })
      .finally(() => setFlashcardLoading(false));
  }, []);

  const handleFlashcardRate = useCallback((cardId: string, rating: SessionRating) => {
    if (rating === 3 || rating === 4) {
      setHardCards(prev => prev.filter(c => c.id !== cardId));
      setFlashcardQueue(prev => prev.filter(c => c.id !== cardId));
    } else {
      // again/hard: rotate card to the end of the queue
      setFlashcardQueue(prev => {
        const card = prev.find(c => c.id === cardId);
        if (!card) return prev;
        return [...prev.filter(c => c.id !== cardId), card];
      });
    }
  }, []);

  const failedQuestions = useMemo<FailedQuestion[]>(() => {
    const byId = new Map(bankQuestions.map(q => [q.quizId, q]));
    const seen = new Map<string, FailedQuestion>();
    const everCorrect = new Set<string>(practiceCorrectIds);

    for (const submission of submissions) {
      const questionsToCheck = getAnsweredQuestionsForSubmission(submission, bankQuestions, byId);

      for (const question of questionsToCheck) {
        const selectedAnswer = submission.answers?.[question.quizId] ?? '';
        if (selectedAnswer && isQuizOptionCorrect(selectedAnswer, question.correctAnswer)) {
          everCorrect.add(question.quizId);
          continue;
        }
        if (!seen.has(question.quizId)) {
          seen.set(question.quizId, {
            question,
            selectedAnswer,
            sourceName: question.sourceName ?? submission.documentName ?? submission.videoName ?? 'Unknown',
          });
        }
      }
    }

    for (const id of everCorrect) seen.delete(id);

    return Array.from(seen.values());
  }, [bankQuestions, submissions, practiceCorrectIds]);

  const unmasteredTerms = useMemo(
    () => allTerms.filter(t => !masteredIds.has(t.id)),
    [allTerms, masteredIds],
  );

  const handleToggleMastered = useCallback(async (termId: string) => {
    setTogglingId(termId);
    setMasteredIds(prev => {
      const next = new Set(prev);
      next.has(termId) ? next.delete(termId) : next.add(termId);
      masteredService.updateCache(userId, next);
      return next;
    });
    try {
      await masteredService.toggle(userId, termId);
    } catch {
      setMasteredIds(prev => {
        const next = new Set(prev);
        next.has(termId) ? next.delete(termId) : next.add(termId);
        masteredService.updateCache(userId, next);
        return next;
      });
    } finally {
      setTogglingId(null);
    }
  }, [userId]);

  const handleStartPractice = () => {
    const unique = failedQuestions.map(f => f.question);
    setExamQuestions(shuffle(unique).slice(0, 50).map(toQuizQuestion));
  };

  const handlePracticeComplete = useCallback(async (correctIds: string[]) => {
    if (correctIds.length === 0) return;

    // Optimistic local update so the list shrinks immediately
    setPracticeCorrectIds(prev => new Set([...prev, ...correctIds]));

    const correctIdSet = new Set(correctIds);

    // Group correctly-answered questions by source
    const docGroups = new Map<string, { courseId: string; questions: typeof bankQuestions }>();
    const videoGroups = new Map<string, typeof bankQuestions>();

    for (const q of bankQuestions) {
      if (!correctIdSet.has(q.quizId)) continue;
      if (q.sourceType === 'document' && q.documentId && q.courseId) {
        if (!docGroups.has(q.documentId)) docGroups.set(q.documentId, { courseId: q.courseId, questions: [] });
        docGroups.get(q.documentId)!.questions.push(q);
      } else if (q.sourceType === 'video' && q.youTubeVideoId) {
        if (!videoGroups.has(q.youTubeVideoId)) videoGroups.set(q.youTubeVideoId, []);
        videoGroups.get(q.youTubeVideoId)!.push(q);
      }
    }

    const saves: Promise<unknown>[] = [];

    for (const [documentId, { courseId, questions }] of docGroups) {
      const existing = submissions.find(s => s.documentId === documentId);
      const mergedAnswers = { ...(existing?.answers ?? {}) };
      for (const q of questions) mergedAnswers[q.quizId] = q.correctAnswer;

      const sourceQs = bankQuestions.filter(q => q.sourceType === 'document' && q.documentId === documentId);
      const total = Math.max(sourceQs.length, existing?.total ?? 0);
      const score = sourceQs.filter(q => {
        const ans = mergedAnswers[q.quizId];
        return ans && isQuizOptionCorrect(ans, q.correctAnswer);
      }).length;

      saves.push(documentService.saveQuizSubmission(courseId, documentId, mergedAnswers, score, total).catch(() => { }));
    }

    for (const [videoId, questions] of videoGroups) {
      const existing = submissions.find(s => s.youTubeVideoId === videoId);
      const mergedAnswers = { ...(existing?.answers ?? {}) };
      for (const q of questions) mergedAnswers[q.quizId] = q.correctAnswer;

      const sourceQs = bankQuestions.filter(q => q.sourceType === 'video' && q.youTubeVideoId === videoId);
      const total = Math.max(sourceQs.length, existing?.total ?? 0);
      const score = sourceQs.filter(q => {
        const ans = mergedAnswers[q.quizId];
        return ans && isQuizOptionCorrect(ans, q.correctAnswer);
      }).length;

      saves.push(youtubeService.submitQuiz(videoId, mergedAnswers, score, total).catch(() => { }));
    }

    await Promise.all(saves);

    // Refresh submissions so the correct state is reflected after page reload too
    quizSubmissionService.clearListCache();
    getAllQuizSubmissions()
      .then(setSubmissions)
      .catch(() => { });
  }, [bankQuestions, submissions]);

  const modules = [
    {
      id: 'quiz' as ActiveModule,
      icon: <XCircle size={20} />,
      title: 'Quiz Mistakes',
      count: failedQuestions.length,
      loading: quizLoading,
      color: 'text-red-500',
      activeBg: 'bg-red-50 dark:bg-red-950/30',
      activeBorder: 'border-red-400',
    },
    {
      id: 'glossary' as ActiveModule,
      icon: <BookMarked size={20} />,
      title: 'Unmastered Glossary',
      count: unmasteredTerms.length,
      loading: glossaryLoading,
      color: 'text-amber-500',
      activeBg: 'bg-amber-50 dark:bg-amber-950/30',
      activeBorder: 'border-amber-400',
    },
    {
      id: 'flashcards' as ActiveModule,
      icon: <BrainCircuit size={20} />,
      title: 'Hard Flashcards',
      count: hardCards.length,
      loading: flashcardLoading,
      color: 'text-[#059669]',
      activeBg: 'bg-[#059669]/10 dark:bg-[#059669]/20',
      activeBorder: 'border-[#059669]',
    },
  ];

  const active = modules.find(m => m.id === activeModule)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-black text-text-main">
            Reinforcement <span className="text-primary">Center</span>
          </h1>
          <p className="text-zinc-500 font-medium">
            Strengthen weak areas by combining quiz mistakes, hard flashcards, and unmastered glossary terms.
          </p>
        </div>
      </div>

      {/* Module selector cards */}
      <div className="grid grid-cols-3 gap-3">
        {modules.map(mod => {
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={[
                'relative rounded-xl border-2 p-4 text-left transition-all',
                'hover:shadow-sm focus:outline-none',
                isActive
                  ? `${mod.activeBorder} ${mod.activeBg}`
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--primary)]/40',
              ].join(' ')}
            >
              <span className={`${mod.color} ${isActive ? '' : 'opacity-70'}`}>
                {mod.icon}
              </span>
              <p className={`mt-2 text-xs font-semibold leading-tight ${isActive ? 'text-text-main' : 'text-text-muted'}`}>
                {mod.title}
              </p>
              <div className="mt-2 flex items-center gap-1">
                {mod.loading ? (
                  <Loader2 size={13} className="animate-spin text-text-muted" />
                ) : (
                  <span className={`text-xl font-bold ${isActive ? mod.color : 'text-text-main'}`}>
                    {mod.count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Content panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeModule}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {/* Quiz Mistakes content */}
          {activeModule === 'quiz' && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <XCircle size={18} className="text-red-500" />
                  <h2 className="font-semibold text-text-main">Quiz Mistakes</h2>
                  {!quizLoading && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                      {failedQuestions.length}
                    </span>
                  )}
                </div>
                {failedQuestions.length > 0 && (
                  <button
                    onClick={handleStartPractice}
                    className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                  >
                    <Play size={12} />
                    Practice
                  </button>
                )}
              </div>

              {quizLoading ? (
                <LoadingRows />
              ) : failedQuestions.length === 0 ? (
                <EmptyState message="No mistakes found. Keep it up!" />
              ) : (
                <div className="space-y-2">
                  {failedQuestions.slice(0, 10).map(({ question, selectedAnswer, sourceName }) => (
                    <QuizMistakeCard
                      key={question.quizId}
                      question={question}
                      selectedAnswer={selectedAnswer}
                      sourceName={sourceName}
                    />
                  ))}
                  {failedQuestions.length > 10 && (
                    <p className="text-center text-xs text-text-muted pt-1">
                      +{failedQuestions.length - 10} more — start practice to see all
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Unmastered Glossary content */}
          {activeModule === 'glossary' && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookMarked size={18} className="text-amber-500" />
                  <h2 className="font-semibold text-text-main">Unmastered Glossary</h2>
                  {!glossaryLoading && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
                      {unmasteredTerms.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate('/glossary?mastery=unmastered')}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-[var(--primary)] transition-colors"
                >
                  View all <ChevronRight size={12} />
                </button>
              </div>

              {glossaryLoading ? (
                <LoadingRows />
              ) : unmasteredTerms.length === 0 ? (
                <EmptyState message="All glossary terms mastered!" />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
                  {unmasteredTerms.map(term => (
                    <GlossaryTermCard
                      key={term.id}
                      term={term}
                      isMastered={masteredIds.has(term.id)}
                      onToggleMastered={handleToggleMastered}
                      isTogglingMastered={togglingId === term.id}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Hard Flashcards content */}
          {activeModule === 'flashcards' && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={18} className="text-[#059669]" />
                  <h2 className="font-semibold text-text-main">Hard Flashcards</h2>
                  {!flashcardLoading && (
                    <span className="rounded-full bg-[#059669]/15 px-2 py-0.5 text-xs font-medium text-[#059669]">
                      {hardCards.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate('/flashcards')}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-[var(--primary)] transition-colors"
                >
                  Review all <ChevronRight size={12} />
                </button>
              </div>

              {flashcardLoading ? (
                <LoadingRows />
              ) : hardCards.length === 0 ? (
                <EmptyState message="No hard flashcards. Classify cards in Flashcards to track difficulty." />
              ) : flashcardQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-color)] py-10 text-center space-y-3">
                  <p className="text-sm font-semibold text-text-main">Session complete!</p>
                  <p className="text-xs text-text-muted">All cards rated Good or Easy this round.</p>
                  <button
                    onClick={() => setFlashcardQueue(hardCards)}
                    className="mt-1 rounded-lg bg-[#059669] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#047857] transition-colors"
                  >
                    Review again
                  </button>
                </div>
              ) : (
                <HardFlashcardReview
                  cards={flashcardQueue}
                  onRate={handleFlashcardRate}
                />
              )}
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <TimedExamModal
        isOpen={examQuestions.length > 0}
        onClose={() => setExamQuestions([])}
        questions={examQuestions}
        sourceTitle="Quiz Mistakes Practice"
        onComplete={handlePracticeComplete}
      />
    </div>
  );
};

const LoadingRows: React.FC = () => (
  <div className="space-y-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-16 rounded-xl bg-zinc-100 animate-pulse" />
    ))}
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-xl border border-dashed border-[var(--border-color)] py-8 text-center">
    <p className="text-sm text-text-muted">{message}</p>
  </div>
);

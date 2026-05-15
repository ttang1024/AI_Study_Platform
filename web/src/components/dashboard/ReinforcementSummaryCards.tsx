import React, { useState, useEffect, useMemo } from 'react';
import { XCircle, BookMarked, BrainCircuit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { flashcardService } from '../../services/flashcardService';
import { glossaryService } from '../../services/glossaryService';
import { masteredService } from '../../services/masteredService';
import { questionBankService, QuestionBankQuestion } from '../../services/questionBankService';
import { quizSubmissionService, QuizSubmission } from '../../services/documentService';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { ReinforcementModuleCard, ReinforcementModuleCardDef } from '../reinforcement/ReinforcementModuleCard';

const getAllQuizSubmissions = async (): Promise<QuizSubmission[]> => {
  const firstPage = await quizSubmissionService.getAllSubmissions(1, 200);
  if (firstPage.totalCount <= firstPage.items.length) return firstPage.items;
  const fullPage = await quizSubmissionService.getAllSubmissions(1, firstPage.totalCount);
  return fullPage.items;
};

const isVideoSubmission = (s: QuizSubmission) =>
  Boolean(s.youTubeVideoId || s.sourceType === 'video');

const getAnsweredQuestionsForSubmission = (
  submission: QuizSubmission,
  bankQuestions: QuestionBankQuestion[],
  byId: Map<string, QuestionBankQuestion>,
) => {
  const answerIds = Object.keys(submission.answers ?? {});
  const answeredIds = new Set(answerIds);
  const sourceQs = bankQuestions.filter(q =>
    isVideoSubmission(submission)
      ? q.sourceType === 'video' && q.youTubeVideoId === submission.youTubeVideoId
      : q.sourceType === 'document' && q.documentId === submission.documentId,
  );
  const candidates = sourceQs.length > 0
    ? sourceQs
    : answerIds.map(id => byId.get(id)).filter((q): q is QuestionBankQuestion => Boolean(q));
  return candidates.filter(q => answeredIds.has(q.quizId));
};

export const ReinforcementSummaryCards: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';

  const [bankQuestions, setBankQuestions] = useState<QuestionBankQuestion[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [quizLoading, setQuizLoading] = useState(true);

  const [allTerms, setAllTerms] = useState<{ id: string }[]>([]);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => masteredService.getCached(userId));
  const [glossaryLoading, setGlossaryLoading] = useState(true);

  const [hardCardCount, setHardCardCount] = useState(0);
  const [flashcardLoading, setFlashcardLoading] = useState(true);

  useEffect(() => {
    setQuizLoading(true);
    Promise.all([questionBankService.getQuestions(), getAllQuizSubmissions()])
      .then(([qs, subs]) => { setBankQuestions(qs); setSubmissions(subs); })
      .catch(() => {})
      .finally(() => setQuizLoading(false));
  }, []);

  useEffect(() => {
    setGlossaryLoading(true);
    Promise.all([glossaryService.getAllGlossary(), masteredService.loadFromServer(userId)])
      .then(([terms, ids]) => { setAllTerms(terms); setMasteredIds(ids); })
      .catch(() => {})
      .finally(() => setGlossaryLoading(false));
  }, [userId]);

  useEffect(() => {
    setFlashcardLoading(true);
    flashcardService.getAllFlashcards(1, 500)
      .then(data => setHardCardCount(data.items.filter(c => c.difficulty === 'hard').length))
      .catch(() => {})
      .finally(() => setFlashcardLoading(false));
  }, []);

  const failedCount = useMemo(() => {
    const byId = new Map(bankQuestions.map(q => [q.quizId, q]));
    const seen = new Set<string>();
    const everCorrect = new Set<string>();
    for (const sub of submissions) {
      for (const q of getAnsweredQuestionsForSubmission(sub, bankQuestions, byId)) {
        const ans = sub.answers?.[q.quizId] ?? '';
        if (ans && isQuizOptionCorrect(ans, q.correctAnswer)) {
          everCorrect.add(q.quizId);
        } else if (!seen.has(q.quizId)) {
          seen.add(q.quizId);
        }
      }
    }
    for (const id of everCorrect) seen.delete(id);
    return seen.size;
  }, [bankQuestions, submissions]);

  const unmasteredCount = useMemo(
    () => allTerms.filter(t => !masteredIds.has(t.id)).length,
    [allTerms, masteredIds],
  );

  const cards: ReinforcementModuleCardDef[] = [
    {
      id: 'quiz',
      icon: <XCircle size={18} />,
      title: 'Quiz Mistakes',
      count: failedCount,
      loading: quizLoading,
      color: 'text-red-500',
      iconBg: 'bg-red-100',
      activeBg: 'bg-red-50',
      activeBorder: 'border-red-200',
      activeShadow: '0 1px 3px rgba(239,68,68,0.1), 0 6px 20px rgba(239,68,68,0.08)',
    },
    {
      id: 'glossary',
      icon: <BookMarked size={18} />,
      title: 'Unmastered Terms',
      count: unmasteredCount,
      loading: glossaryLoading,
      color: 'text-amber-500',
      iconBg: 'bg-amber-100',
      activeBg: 'bg-amber-50',
      activeBorder: 'border-amber-200',
      activeShadow: '0 1px 3px rgba(245,158,11,0.1), 0 6px 20px rgba(245,158,11,0.08)',
    },
    {
      id: 'flashcards',
      icon: <BrainCircuit size={18} />,
      title: 'Hard Flashcards',
      count: hardCardCount,
      loading: flashcardLoading,
      color: 'text-[#059669]',
      iconBg: 'bg-[#059669]/15',
      activeBg: 'bg-[#059669]/5',
      activeBorder: 'border-[#059669]/30',
      activeShadow: '0 1px 3px rgba(5,150,105,0.1), 0 6px 20px rgba(5,150,105,0.08)',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(card => (
        <ReinforcementModuleCard
          key={card.id}
          {...card}
          to={`/reinforcement-center?tab=${card.id}`}
          hoverActive
        />
      ))}
    </div>
  );
};

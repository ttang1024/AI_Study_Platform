import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, XCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { QuestionBankQuestion } from '../../services/questionBankService';
import { useStudy } from '../../context/StudyContext';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

interface QuizMistakeCardProps {
  question: QuestionBankQuestion;
  selectedAnswer: string;
  sourceName: string;
}

export const QuizMistakeCard: React.FC<QuizMistakeCardProps> = ({
  question,
  selectedAnswer,
  sourceName,
}) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const navigate = useNavigate();
  const { documents, ensureDocuments } = useStudy();

  // documents is loaded lazily by StudyContext; pull it so the source link can
  // route to the correct detail page (audio / article / document) by doc type.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);

  const handleSourceClick = () => {
    const state = { activeTab: 'quiz' };
    if (question.youTubeVideoId) {
      navigate(`/videos/${question.youTubeVideoId}`, { state });
    } else if (question.documentId) {
      const doc = documents.find(d => d.id === question.documentId);
      if (doc?.type === 'audio' || doc?.type === 'podcast') {
        navigate(`/audio/${question.documentId}`, { state });
      } else if (doc?.originalUrl) {
        navigate(`/articles/${question.documentId}`, { state });
      } else {
        navigate(`/documents/${question.documentId}`, { state });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 flex flex-col gap-3"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-main leading-snug flex-1">
          {question.question}
        </p>
        <button
          onClick={() => setShowAnswer(v => !v)}
          title={showAnswer ? 'Hide answer' : 'Reveal correct answer'}
          className={cn(
            'shrink-0 rounded-lg p-1.5 transition-colors',
            showAnswer
              ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
              : 'text-text-muted hover:bg-[var(--bg-sidebar)] hover:text-[var(--primary)]',
          )}
        >
          {showAnswer ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-1.5">
        {question.options.map((option, i) => {
          const isSelected = !!selectedAnswer && isQuizOptionCorrect(option, selectedAnswer);
          const isCorrect = isQuizOptionCorrect(option, question.correctAnswer);
          const revealCorrect = showAnswer && isCorrect;

          const style = (() => {
            if (isSelected && !isCorrect)
              return 'border-red-300 bg-red-50 text-red-700';
            if (revealCorrect)
              return 'border-emerald-300 bg-emerald-50 text-emerald-700';
            return 'border-[var(--border-color)] bg-[var(--bg-sidebar)] text-text-muted';
          })();

          const letterStyle = (() => {
            if (isSelected && !isCorrect) return 'bg-red-100 text-red-600';
            if (revealCorrect) return 'bg-emerald-100 text-emerald-600';
            return 'bg-zinc-100 text-zinc-500';
          })();

          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                style,
              )}
            >
              <span className="flex-1 leading-snug">{option}</span>
              {isSelected && !isCorrect && (
                <XCircle size={14} className="shrink-0 text-red-500" />
              )}
              {revealCorrect && (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Explanation — shown when answer is revealed */}
      {showAnswer && question.explanation && (
        <p className="text-xs text-text-muted bg-[var(--bg-sidebar)] rounded-lg px-3 py-2 leading-relaxed border border-[var(--border-color)]">
          {question.explanation}
        </p>
      )}

      {/* Source */}
      {sourceName && (
        <button
          onClick={handleSourceClick}
          className="text-[10px] text-text-muted/60 truncate text-left hover:text-[var(--primary)] hover:underline transition-colors"
        >
          {sourceName}
        </button>
      )}
    </motion.div>
  );
};

import React from 'react';
import { Award, Eye, EyeOff, Loader2, Search, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { getDifficultyLabel } from '../../services/questionBankService';
import { QuestionBankQuestion } from '../../services/questionBankService';
import { QuizSubmission } from '../../services/documentService';
import { Course } from '../../types';
import { Select } from '../common/Select';

export interface FailedQuestion {
  question: QuestionBankQuestion;
  submission: QuizSubmission;
  selectedAnswer: string;
  correctAnswer: string;
  sourceName: string;
  courseName?: string;
  courseColor?: string;
  submittedAt: string;
}

interface FailedQuestionsTabProps {
  courses: Course[];
  loading: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  courseId: string;
  onCourseChange: (id: string) => void;
  questions: FailedQuestion[];
  revealedAnswers: Set<string>;
  onToggleAnswer: (id: string) => void;
  onRefresh: () => void;
}

export const FailedQuestionsTab: React.FC<FailedQuestionsTabProps> = ({
  courses,
  loading,
  search,
  onSearchChange,
  courseId,
  onCourseChange,
  questions,
  revealedAnswers,
  onToggleAnswer,
  onRefresh,
}) => (
  <>
    <div className="rounded-2xl border border-[var(--border-color)] bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search failed questions..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <Select value={courseId} onChange={e => onCourseChange(e.target.value)}>
          <option value="all">All courses</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>{course.name}</option>
          ))}
        </Select>
      </div>
    </div>

    <div className="flex items-center justify-between text-sm text-text-muted">
      <span className="inline-flex items-center gap-2">
        <XCircle size={14} /> {questions.length} failed questions
      </span>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="font-semibold text-primary hover:underline disabled:opacity-40"
      >
        Refresh
      </button>
    </div>

    {loading ? (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    ) : questions.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center">
        <Award size={34} className="mx-auto mb-3 text-zinc-300" />
        <h3 className="font-bold text-text-main">No failed questions found</h3>
        <p className="mt-1 text-sm text-text-muted">
          Wrong quiz answers will appear here after you submit quizzes.
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {questions.map(item => {
          const cardKey = `${item.submission.submissionId}-${item.question.quizId}`;
          const revealed = revealedAnswers.has(item.question.quizId);
          return (
            <div key={cardKey} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {getDifficultyLabel(item.question.difficulty)}
                    </span>
                    {item.courseName && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: item.courseColor ?? '#0d9488' }}
                      >
                        {item.courseName}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">{item.sourceName}</span>
                    <span className="text-xs text-text-muted">
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold leading-relaxed text-text-main">
                    {item.question.question}
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {item.question.options.map((option, index) => {
                      const correct = isQuizOptionCorrect(option, item.question.correctAnswer);
                      const selected = item.selectedAnswer && isQuizOptionCorrect(option, item.selectedAnswer);
                      return (
                        <div
                          key={`${item.question.quizId}-${index}`}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-sm',
                            revealed && correct
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : !!(selected && !correct)
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-zinc-100 bg-zinc-50 text-text-main',
                          )}
                        >
                          {option}
                        </div>
                      );
                    })}
                  </div>
                  {revealed && item.question.explanation && (
                    <p className="mt-3 text-sm text-text-muted">{item.question.explanation}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => onToggleAnswer(item.question.quizId)}
                    className={cn(
                      'rounded-lg p-2',
                      revealed
                        ? 'text-primary bg-primary/10'
                        : 'text-text-muted hover:bg-primary/10 hover:text-primary',
                    )}
                    title={revealed ? 'Hide correct answer' : 'Show correct answer & explanation'}
                  >
                    {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>
);

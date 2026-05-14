import React from 'react';
import { Check, Edit3, Eye, EyeOff, FileText, Filter, Loader2, Search, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { getCorrectQuizOptionText } from '../../utils/quizAnswers';
import {
  getDifficultyLabel,
  QuestionBankQuestion,
  QuestionDifficulty,
} from '../../services/questionBankService';
import { Course } from '../../types';
import { Select } from '../common/Select';

const DIFFICULTY_OPTIONS: Array<'all' | QuestionDifficulty> = ['all', 'easy', 'medium', 'hard'];

interface QuestionBankTabProps {
  courses: Course[];
  loading: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  courseId: string;
  onCourseChange: (id: string) => void;
  difficulty: 'all' | QuestionDifficulty;
  onDifficultyChange: (d: 'all' | QuestionDifficulty) => void;
  questions: QuestionBankQuestion[];
  totalCount?: number;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectFiltered: () => void;
  revealedAnswers: Set<string>;
  onToggleAnswer: (id: string) => void;
  onEdit: (q: QuestionBankQuestion) => void;
  onDelete: (q: QuestionBankQuestion) => void;
}

export const QuestionBankTab: React.FC<QuestionBankTabProps> = ({
  courses,
  loading,
  search,
  onSearchChange,
  courseId,
  onCourseChange,
  difficulty,
  onDifficultyChange,
  questions,
  totalCount,
  selectedIds,
  onSelect,
  onSelectFiltered,
  revealedAnswers,
  onToggleAnswer,
  onEdit,
  onDelete,
}) => (
  <>
    <div className="rounded-2xl border border-[var(--border-color)] bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_140px]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search questions, options, explanations..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <Select value={courseId} onChange={e => onCourseChange(e.target.value)}>
          <option value="all">All courses</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>{course.name}</option>
          ))}
        </Select>
        <Select value={difficulty} onChange={e => onDifficultyChange(e.target.value as 'all' | QuestionDifficulty)}>
          {DIFFICULTY_OPTIONS.map(d => (
            <option key={d} value={d}>
              {d === 'all' ? 'All levels' : getDifficultyLabel(d)}
            </option>
          ))}
        </Select>
      </div>
    </div>

    <div className="flex items-center justify-between text-sm text-text-muted">
      <span className="inline-flex items-center gap-2">
        <Filter size={14} /> {totalCount ?? questions.length} questions
      </span>
      <button
        onClick={onSelectFiltered}
        className="font-semibold text-primary hover:underline"
      >
        Select filtered
      </button>
    </div>

    {loading ? (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    ) : questions.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center">
        <FileText size={34} className="mx-auto mb-3 text-zinc-300" />
        <h3 className="font-bold text-text-main">No questions found</h3>
        <p className="mt-1 text-sm text-text-muted">
          Generate quizzes from documents or videos first, then manage them here.
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {questions.map(question => {
          const selected = selectedIds.has(question.quizId);
          const revealed = revealedAnswers.has(question.quizId);
          return (
            <div
              key={question.quizId}
              className={cn(
                'rounded-2xl border bg-white p-4 shadow-sm',
                selected ? 'border-primary/50' : 'border-[var(--border-color)]',
              )}
            >
              <div className="flex gap-3">
                <button
                  onClick={() => onSelect(question.quizId)}
                  className={cn(
                    'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    selected ? 'border-primary bg-primary text-white' : 'border-zinc-300',
                  )}
                  title="Select question"
                >
                  {selected && <Check size={13} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {getDifficultyLabel(question.difficulty)}
                    </span>
                    {question.courseName && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: question.courseColor ?? '#0d9488' }}
                      >
                        {question.courseName}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      {question.sourceName ?? question.sourceType}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold leading-relaxed text-text-main">
                    {question.question}
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {question.options.map((option, index) => {
                      const correct = getCorrectQuizOptionText(question.options, question.correctAnswer) === option;
                      return (
                        <div
                          key={`${question.quizId}-${index}`}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-sm',
                            revealed && correct
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-100 bg-zinc-50 text-text-main',
                          )}
                        >
                          {option}
                        </div>
                      );
                    })}
                  </div>
                  {revealed && question.explanation && (
                    <p className="mt-3 text-sm text-text-muted">{question.explanation}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    onClick={() => onToggleAnswer(question.quizId)}
                    className={cn(
                      'rounded-lg p-2',
                      revealed
                        ? 'text-primary bg-primary/10'
                        : 'text-text-muted hover:bg-primary/10 hover:text-primary',
                    )}
                    title={revealed ? 'Hide answer' : 'Show answer'}
                  >
                    {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => onEdit(question)}
                    className="rounded-lg p-2 text-text-muted hover:bg-primary/10 hover:text-primary"
                    title="Edit question"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(question)}
                    className="rounded-lg p-2 text-text-muted hover:bg-red-50 hover:text-red-500"
                    title="Delete question"
                  >
                    <Trash2 size={16} />
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

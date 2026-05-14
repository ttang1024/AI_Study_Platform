import React, { useEffect, useMemo, useState } from 'react';
import { Award, Check, Download, Edit3, FileText, Filter, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { TimedExamModal } from '../components/quiz/TimedExamModal';
import { QuizQuestion } from '../types';
import { getCorrectQuizOptionText } from '../utils/quizAnswers';
import {
  questionBankService,
  QuestionBankQuestion,
  QuestionDifficulty,
} from '../services/questionBankService';
import {
  downloadMoodleGift,
  downloadQtiZip,
  downloadQuizCsv,
  ExportQuizRecord,
} from '../services/exportInteropService';
import { cn } from '../utils/cn';
import { Select } from '../components/common/Select';

const difficultyOptions: Array<'all' | QuestionDifficulty> = ['all', 'easy', 'medium', 'hard'];

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

export const QuestionBankPage: React.FC = () => {
  const { courses } = useStudy();
  const [questions, setQuestions] = useState<QuestionBankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [sourceType, setSourceType] = useState<'all' | 'document' | 'video'>('all');
  const [difficulty, setDifficulty] = useState<'all' | QuestionDifficulty>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<QuestionBankQuestion | null>(null);
  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);
  const [examTitle, setExamTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<null | 'csv' | 'gift' | 'qti'>(null);

  const loadQuestions = React.useCallback(async () => {
    setLoading(true);
    try {
      const items = await questionBankService.getQuestions({
        courseId: courseId === 'all' ? undefined : courseId,
        sourceType: sourceType === 'all' ? undefined : sourceType,
        difficulty: difficulty === 'all' ? undefined : difficulty,
      });
      setQuestions(items);
    } finally {
      setLoading(false);
    }
  }, [courseId, sourceType, difficulty]);

  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter(item =>
      [item.question, item.explanation, item.sourceName, item.courseName, item.difficulty, ...item.options]
        .some(value => value?.toLowerCase().includes(q)),
    );
  }, [questions, search]);

  const selectedQuestions = useMemo(() =>
    filtered.filter(q => selectedIds.has(q.quizId)),
    [filtered, selectedIds],
  );

  const exportRecords = (items: QuestionBankQuestion[]): ExportQuizRecord[] => [{
    title: 'Question Bank',
    questions: items.map(q => ({
      question: q.question,
      options: q.options,
      correctAnswer: getCorrectQuizOptionText(q.options, q.correctAnswer),
      explanation: q.explanation,
    })),
  }];

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartExam = (mode: 'selected' | 'filtered') => {
    const pool = mode === 'selected' && selectedQuestions.length > 0 ? selectedQuestions : filtered;
    const questionsForExam = shuffle(pool).slice(0, Math.min(50, pool.length)).map(toQuizQuestion);
    setExamQuestions(questionsForExam);
    setExamTitle(mode === 'selected' ? 'Selected Questions' : 'Filtered Question Bank');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await questionBankService.updateQuestion(editing.quizId, {
        question: editing.question,
        options: editing.options,
        correctAnswer: editing.correctAnswer,
        explanation: editing.explanation,
        difficulty: editing.difficulty,
      });
      setQuestions(prev => prev.map(q => q.quizId === updated.quizId ? updated : q));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (question: QuestionBankQuestion) => {
    await questionBankService.deleteQuestion(question.quizId);
    setQuestions(prev => prev.filter(q => q.quizId !== question.quizId));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(question.quizId);
      return next;
    });
  };

  const handleExport = async (format: 'csv' | 'gift' | 'qti') => {
    const items = selectedQuestions.length > 0 ? selectedQuestions : filtered;
    setExporting(format);
    try {
      const records = exportRecords(items);
      if (format === 'csv') downloadQuizCsv(records, 'question_bank');
      else if (format === 'gift') downloadMoodleGift(records, 'question_bank');
      else await downloadQtiZip(records, 'question_bank');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary border border-primary/20">
            <Award size={14} />
            Reusable Assessment
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-text-main">Question Bank</h1>
          <p className="mt-2 max-w-2xl text-text-muted">Edit generated questions and assemble mock exams across courses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleStartExam('selected')}
            disabled={selectedQuestions.length === 0 && filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            <Plus size={15} />
            Mock Exam
          </button>
          {(['csv', 'gift', 'qti'] as const).map(format => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={!!exporting || filtered.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-3 py-2 text-xs font-bold text-text-main hover:border-primary/40 disabled:opacity-40"
            >
              {exporting === format ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_160px_140px_140px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions, options, explanations..."
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <Select value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="all">All courses</option>
            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </Select>
          <Select value={sourceType} onChange={e => setSourceType(e.target.value as any)}>
            <option value="all">All sources</option>
            <option value="document">Documents</option>
            <option value="video">Videos</option>
          </Select>
          <Select value={difficulty} onChange={e => setDifficulty(e.target.value as any)}>
            {difficultyOptions.map(d => <option key={d} value={d}>{d === 'all' ? 'All levels' : d}</option>)}
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span className="inline-flex items-center gap-2"><Filter size={14} /> {filtered.length} questions</span>
        <button
          onClick={() => setSelectedIds(new Set(filtered.map(q => q.quizId)))}
          className="font-semibold text-primary hover:underline"
        >
          Select filtered
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center">
          <FileText size={34} className="mx-auto mb-3 text-zinc-300" />
          <h3 className="font-bold text-text-main">No questions found</h3>
          <p className="mt-1 text-sm text-text-muted">Generate quizzes from documents or videos first, then manage them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(question => {
            const selected = selectedIds.has(question.quizId);
            return (
              <div key={question.quizId} className={cn('rounded-2xl border bg-white p-4 shadow-sm', selected ? 'border-primary/50' : 'border-[var(--border-color)]')}>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSelect(question.quizId)}
                    className={cn('mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border', selected ? 'border-primary bg-primary text-white' : 'border-zinc-300')}
                    title="Select question"
                  >
                    {selected && <Check size={13} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{question.difficulty}</span>
                      {question.courseName && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: question.courseColor ?? '#0d9488' }}>{question.courseName}</span>
                      )}
                      <span className="text-xs text-text-muted">{question.sourceName ?? question.sourceType}</span>
                    </div>
                    <p className="mt-2 font-semibold leading-relaxed text-text-main">{question.question}</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {question.options.map((option, index) => {
                        const correct = getCorrectQuizOptionText(question.options, question.correctAnswer) === option;
                        return (
                          <div key={`${question.quizId}-${index}`} className={cn('rounded-xl border px-3 py-2 text-sm', correct ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-100 bg-zinc-50 text-text-main')}>
                            {option}
                          </div>
                        );
                      })}
                    </div>
                    {question.explanation && <p className="mt-3 text-sm text-text-muted">{question.explanation}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button onClick={() => setEditing(question)} className="rounded-lg p-2 text-text-muted hover:bg-primary/10 hover:text-primary" title="Edit question">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(question)} className="rounded-lg p-2 text-text-muted hover:bg-red-50 hover:text-red-500" title="Delete question">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-main">Edit Question</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100"><X size={18} /></button>
            </div>
            <div className="mt-4 space-y-3">
              <textarea value={editing.question} onChange={e => setEditing({ ...editing, question: e.target.value })} className="min-h-24 w-full rounded-xl border border-[var(--border-color)] p-3 text-sm outline-none focus:border-primary" />
              {editing.options.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={e => setEditing({ ...editing, options: editing.options.map((o, i) => i === index ? e.target.value : o) })}
                  className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-primary"
                />
              ))}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select
                  value={getCorrectQuizOptionText(editing.options, editing.correctAnswer)}
                  onChange={e => setEditing({ ...editing, correctAnswer: e.target.value })}
                >
                  {editing.options.map((option, index) => (
                    <option key={`${index}-${option}`} value={option}>
                      {option || 'Blank option'}
                    </option>
                  ))}
                </Select>
                <Select value={editing.difficulty} onChange={e => setEditing({ ...editing, difficulty: e.target.value as QuestionDifficulty })}>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </Select>
              </div>
              <textarea value={editing.explanation} onChange={e => setEditing({ ...editing, explanation: e.target.value })} placeholder="Explanation" className="min-h-20 w-full rounded-xl border border-[var(--border-color)] p-3 text-sm outline-none focus:border-primary" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-bold text-text-muted">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TimedExamModal
        isOpen={examQuestions.length > 0}
        onClose={() => setExamQuestions([])}
        questions={examQuestions}
        sourceTitle={examTitle}
        timeLimitMinutes={Math.max(5, Math.ceil(examQuestions.length * 1.5))}
      />
    </div>
  );
};

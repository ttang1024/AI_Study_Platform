import React, { useState, useMemo, useEffect } from 'react';
import { QuizQuestion } from '../../types';
import { getCorrectQuizOptionText, shuffle } from '../../utils/quizAnswers';
import {
  questionBankService,
  QuestionBankQuestion,
  QuestionDifficulty,
  getDifficultyLabel,
} from '../../services/questionBankService';
import { ExportQuizRecord, downloadMoodleGift, downloadQtiZip, downloadQuizCsv } from '../../services/exportInteropService';
import { BANK_PAGE_SIZE, MainTab, toQuizQuestion } from './types';

const bankExportRecords = (items: QuestionBankQuestion[]): ExportQuizRecord[] => [{
  title: 'Question Bank',
  questions: items.map(q => ({
    question: q.question,
    options: q.options,
    correctAnswer: getCorrectQuizOptionText(q.options, q.correctAnswer),
    explanation: q.explanation,
  })),
}];

/**
 * Owns the "Question Bank" tab: filtered/paginated question loading, multi-select,
 * editing, deletion, interop export and the mock-exam builder. Questions reload
 * whenever the bank tab activates or its course/difficulty filters change.
 */
export function useQuestionBank(mainTab: MainTab) {
  const [bankQuestions, setBankQuestions] = useState<QuestionBankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankCourseId, setBankCourseId] = useState('all');
  const [bankDifficulty, setBankDifficulty] = useState<'all' | QuestionDifficulty>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<QuestionBankQuestion | null>(null);
  const [bankExamQuestions, setBankExamQuestions] = useState<QuizQuestion[]>([]);
  const [bankExamTitle, setBankExamTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [bankExporting, setBankExporting] = useState<null | 'csv' | 'gift' | 'qti'>(null);
  const [bankPage, setBankPage] = useState(1);

  const loadBankQuestions = React.useCallback(async () => {
    setBankLoading(true);
    try {
      const items = await questionBankService.getQuestions({
        courseId: bankCourseId === 'all' ? undefined : bankCourseId,
        difficulty: bankDifficulty === 'all' ? undefined : bankDifficulty,
      });
      setBankQuestions(items);
    } finally {
      setBankLoading(false);
    }
  }, [bankCourseId, bankDifficulty]);

  useEffect(() => {
    if (mainTab === 'bank') void loadBankQuestions();
  }, [mainTab, loadBankQuestions]);

  const bankFiltered = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return bankQuestions;
    return bankQuestions.filter(item =>
      [item.question, item.explanation, item.sourceName, item.courseName, getDifficultyLabel(item.difficulty), item.difficulty, ...item.options]
        .some(value => value?.toLowerCase().includes(q)),
    );
  }, [bankQuestions, bankSearch]);

  const selectedQuestions = useMemo(() =>
    bankFiltered.filter(q => selectedIds.has(q.quizId)),
    [bankFiltered, selectedIds],
  );

  const bankTotalPages = Math.max(1, Math.ceil(bankFiltered.length / BANK_PAGE_SIZE));
  const safeBankPage = Math.min(bankPage, bankTotalPages);
  const bankPagedQuestions = bankFiltered.slice((safeBankPage - 1) * BANK_PAGE_SIZE, safeBankPage * BANK_PAGE_SIZE);

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartBankExam = (mode: 'selected' | 'filtered') => {
    const pool = mode === 'selected' && selectedQuestions.length > 0 ? selectedQuestions : bankFiltered;
    const questionsForExam = shuffle(pool).slice(0, Math.min(50, pool.length)).map(toQuizQuestion);
    setBankExamQuestions(questionsForExam);
    setBankExamTitle(mode === 'selected' ? 'Selected Questions' : 'Filtered Question Bank');
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
      setBankQuestions(prev => prev.map(q => q.quizId === updated.quizId ? updated : q));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankQuestion = async (question: QuestionBankQuestion) => {
    await questionBankService.deleteQuestion(question.quizId);
    setBankQuestions(prev => prev.filter(q => q.quizId !== question.quizId));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(question.quizId);
      return next;
    });
  };

  const handleBankExport = async (format: 'csv' | 'gift' | 'qti') => {
    const items = selectedQuestions.length > 0 ? selectedQuestions : bankFiltered;
    setBankExporting(format);
    try {
      const records = bankExportRecords(items);
      if (format === 'csv') downloadQuizCsv(records, 'question_bank');
      else if (format === 'gift') downloadMoodleGift(records, 'question_bank');
      else await downloadQtiZip(records, 'question_bank');
    } finally {
      setBankExporting(null);
    }
  };

  const handleBankFilterChange = (cb: () => void) => { cb(); setBankPage(1); };

  return {
    bankLoading, bankSearch, setBankSearch, bankCourseId, setBankCourseId,
    bankDifficulty, setBankDifficulty, handleBankFilterChange,
    selectedIds, setSelectedIds, selectedQuestions, handleSelect,
    bankFiltered, bankPagedQuestions, bankTotalPages, safeBankPage, setBankPage,
    editing, setEditing, saving, handleSaveEdit, handleDeleteBankQuestion,
    bankExporting, handleBankExport,
    bankExamQuestions, setBankExamQuestions, bankExamTitle, handleStartBankExam,
  };
}

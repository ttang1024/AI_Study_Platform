import React from 'react';
import { X } from 'lucide-react';
import { QuestionBankQuestion, QuestionDifficulty } from '../../services/questionBankService';
import { getCorrectQuizOptionText } from '../../utils/quizAnswers';
import { Select } from '../common/Select';

interface EditQuestionModalProps {
  editing: QuestionBankQuestion;
  saving: boolean;
  onChange: (updated: QuestionBankQuestion) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  editing,
  saving,
  onChange,
  onSave,
  onClose,
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-main">Edit Question</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100">
          <X size={18} />
        </button>
      </div>
      <div className="mt-4 space-y-3">
        <textarea
          value={editing.question}
          onChange={e => onChange({ ...editing, question: e.target.value })}
          className="min-h-24 w-full rounded-xl border border-[var(--border-color)] p-3 text-sm outline-none focus:border-primary"
        />
        {editing.options.map((option, index) => (
          <input
            key={index}
            value={option}
            onChange={e => onChange({
              ...editing,
              options: editing.options.map((o, i) => i === index ? e.target.value : o),
            })}
            className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-primary"
          />
        ))}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            value={getCorrectQuizOptionText(editing.options, editing.correctAnswer)}
            onChange={e => onChange({ ...editing, correctAnswer: e.target.value })}
          >
            {editing.options.map((option, index) => (
              <option key={`${index}-${option}`} value={option}>
                {option || 'Blank option'}
              </option>
            ))}
          </Select>
          <Select
            value={editing.difficulty}
            onChange={e => onChange({ ...editing, difficulty: e.target.value as QuestionDifficulty })}
          >
            <option value="easy">Beginner</option>
            <option value="medium">Intermediate</option>
            <option value="hard">Advanced</option>
          </Select>
        </div>
        <textarea
          value={editing.explanation}
          onChange={e => onChange({ ...editing, explanation: e.target.value })}
          placeholder="Explanation"
          className="min-h-20 w-full rounded-xl border border-[var(--border-color)] p-3 text-sm outline-none focus:border-primary"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-bold text-text-muted"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

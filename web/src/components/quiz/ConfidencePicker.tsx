import React from 'react';
import { cn } from '../../utils/cn';

/** 1 = guessing, 2 = unsure, 3 = confident. Matches ConfidenceLevel on the server. */
export const CONFIDENCE_LEVELS = [
  { level: 1, label: 'Guessing' },
  { level: 2, label: 'Unsure' },
  { level: 3, label: 'Confident' },
] as const;

interface ConfidencePickerProps {
  value: number | undefined;
  onChange: (level: number) => void;
  disabled?: boolean;
}

/**
 * Asks how sure the learner is, before they find out whether they were right.
 *
 * Three coarse levels rather than a percentage: asking for a number makes people deliberate about the
 * number instead of the question, and the only signal worth having is "was I sure?". Rating is optional
 * — a skipped question is recorded as no data rather than as a low rating, which would be a lie.
 */
export const ConfidencePicker: React.FC<ConfidencePickerProps> = ({ value, onChange, disabled }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs text-text-muted">How sure are you?</span>
    {CONFIDENCE_LEVELS.map(({ level, label }) => (
      <button
        key={level}
        type="button"
        disabled={disabled}
        aria-pressed={value === level}
        onClick={() => onChange(level)}
        className={cn(
          'text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50',
          value === level
            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50',
        )}
      >
        {label}
      </button>
    ))}
  </div>
);

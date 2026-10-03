import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { type ExamPlan } from '../../services/plannerService';
import { CreatePlanForm } from './CreatePlanForm';
import { cn } from '../../utils/cn';

interface Course { id: string; name: string }

interface Props {
  plans: ExamPlan[];
  loading: boolean;
  selectedPlanId: string | null;
  courses: Course[];
  onSelect: (planId: string) => void;
  onDelete: (planId: string) => void;
  onCreated: (plan: ExamPlan) => void;
}

export const ExamPlanList: React.FC<Props> = ({
  plans, loading, selectedPlanId, courses, onSelect, onDelete, onCreated,
}) => {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Exam plans</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50"
          title="New exam plan"
        >
          <Plus size={16} />
        </button>
      </div>

      {showCreate && (
        <CreatePlanForm
          courses={courses}
          onCreated={(plan) => { setShowCreate(false); onCreated(plan); }}
        />
      )}

      <ul className="divide-y divide-gray-50">
        {loading ? (
          <li className="px-4 py-3 text-xs text-gray-400">Loading…</li>
        ) : plans.length === 0 ? (
          <li className="px-4 py-4 text-xs text-gray-400">No exam plans yet — add one to get a daily schedule.</li>
        ) : plans.map((p) => (
          <li
            key={p.id}
            className={cn(
              'px-4 py-3 cursor-pointer transition-colors',
              selectedPlanId === p.id ? 'bg-teal-50/60' : 'hover:bg-gray-50',
            )}
            onClick={() => onSelect(p.id)}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-main truncate">{p.title}</p>
                <p className="text-[11px] text-gray-400">
                  {new Date(p.examDate).toLocaleDateString()} {p.courseName ? `· ${p.courseName}` : ''}
                </p>
              </div>
              <span className={cn(
                'text-[11px] font-bold px-2 py-1 rounded-lg',
                p.daysRemaining <= 3 ? 'bg-red-50 text-red-600' : p.daysRemaining <= 7 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500',
              )}>
                {p.daysRemaining}d
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                className="p-1 rounded text-gray-300 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

import React, { useState } from 'react';
import { plannerService, type ExamPlan } from '../../services/plannerService';
import { Select } from '../common/Select';

interface Course { id: string; name: string }

interface Props {
  courses: Course[];
  onCreated: (plan: ExamPlan) => void;
}

/** Self-contained "new exam plan" form: owns its field state and the create call. */
export const CreatePlanForm: React.FC<Props> = ({ courses, onCreated }) => {
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [courseId, setCourseId] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreate = async () => {
    if (!title.trim() || !examDate) return;
    setCreating(true);
    setCreateError('');
    try {
      const plan = await plannerService.createExamPlan({
        title: title.trim(),
        examDate,
        courseId: courseId || undefined,
        dailyMinutes,
      });
      onCreated(plan);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setCreateError(err?.response?.data?.message ?? 'Failed to create plan.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-100 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Exam name (e.g. Biology midterm)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
      />
      <input
        type="date"
        value={examDate}
        onChange={(e) => setExamDate(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
      />
      <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} size="xs">
        <option value="">All courses</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={10}
          max={480}
          value={dailyMinutes}
          onChange={(e) => setDailyMinutes(Number(e.target.value))}
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
        <span className="text-xs text-gray-500">min / day</span>
        <button
          onClick={handleCreate}
          disabled={creating || !title.trim() || !examDate}
          className="ml-auto bg-teal-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>
      {createError && <p className="text-xs text-red-500">{createError}</p>}
    </div>
  );
};

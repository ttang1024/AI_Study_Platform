import React from 'react';
import { Award, Play, Loader2 } from 'lucide-react';
import { Select } from '../common/Select';

interface Course { id: string; name: string }

interface Props {
  courses: Course[];
  mockCourseId: string;
  setMockCourseId: (v: string) => void;
  mockCount: number;
  setMockCount: (v: number) => void;
  mockLoading: boolean;
  mockError: string;
  onStart: () => void;
}

export const MockExamLauncher: React.FC<Props> = ({
  courses, mockCourseId, setMockCourseId, mockCount, setMockCount, mockLoading, mockError, onStart,
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
      <Award size={14} className="text-purple-500" /> Timed mock exam
    </h2>
    <Select value={mockCourseId} onChange={(e) => setMockCourseId(e.target.value)} size="xs">
      <option value="">All courses</option>
      {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </Select>
    <div className="flex items-center gap-2">
      <Select value={String(mockCount)} onChange={(e) => setMockCount(Number(e.target.value))} size="xs" className="w-28">
        {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} questions</option>)}
      </Select>
      <button
        onClick={onStart}
        disabled={mockLoading}
        className="ml-auto inline-flex items-center gap-1.5 bg-purple-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
      >
        {mockLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Start
      </button>
    </div>
    {mockError && <p className="text-xs text-red-500">{mockError}</p>}
    <p className="text-[11px] text-gray-400">Sampled from your quiz bank; wrong answers feed the mistake notebook.</p>
  </div>
);

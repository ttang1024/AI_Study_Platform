import React from 'react';
import {
  CalendarDays, Play, BrainCircuit, Target, BookX, Award, NotebookPen,
} from 'lucide-react';
import { type ExamSchedule } from '../../services/plannerService';
import { type DayBusySummary } from '../../services/calendarService';
import { cn } from '../../utils/cn';

const taskIcon = (type: string) => {
  switch (type) {
    case 'flashcards': return <BrainCircuit size={14} className="text-teal-500" />;
    case 'concept': return <Target size={14} className="text-amber-500" />;
    case 'mistakes': return <BookX size={14} className="text-red-400" />;
    case 'mock-exam': return <Award size={14} className="text-purple-500" />;
    default: return <Play size={14} className="text-gray-400" />;
  }
};

interface Props {
  schedule: ExamSchedule | null;
  scheduleLoading: boolean;
  busyByDate: Record<string, DayBusySummary>;
  onCram: (planId: string) => void;
  onTaskNavigate: (url: string) => void;
}

export const PlannerSchedule: React.FC<Props> = ({
  schedule, scheduleLoading, busyByDate, onCram, onTaskNavigate,
}) => {
  if (scheduleLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
        Select or create an exam plan to see your daily schedule.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl px-5 py-4 flex items-center gap-4">
        <div>
          <p className="text-xs opacity-80">Countdown</p>
          <p className="text-2xl font-black">{schedule.plan.daysRemaining} days</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{schedule.plan.title}</p>
          <p className="text-xs opacity-80">{new Date(schedule.plan.examDate).toLocaleDateString()} · {schedule.plan.dailyMinutes} min/day</p>
        </div>
        <button
          onClick={() => onCram(schedule.plan.id)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25 transition-colors"
          title="One-page AI cheat sheet from your weak spots"
        >
          <NotebookPen size={13} /> Cram sheet
        </button>
      </div>

      {schedule.days.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
          Exam day is here — good luck! 🎓
        </div>
      ) : schedule.days.map((day) => {
        const busy = busyByDate[day.date.slice(0, 10)];
        const busyLabel = busy && busy.busyMinutes > 0
          ? busy.busyMinutes >= 60
            ? `${Math.round(busy.busyMinutes / 60 * 10) / 10}h busy`
            : `${busy.busyMinutes}m busy`
          : null;
        return (
          <div key={day.date} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-gray-50/60">
              <span className="text-xs font-bold text-gray-700">{day.label}</span>
              <span className="text-[11px] text-gray-400">{day.minutes} min</span>
              {busyLabel && (
                <span
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-amber-600"
                  title={busy.blocks.map(b => b.title).join(' · ')}
                >
                  <CalendarDays size={11} /> {busyLabel}
                </span>
              )}
            </div>
            {busy && busy.blocks.length > 0 && (
              <ul className="px-4 py-1.5 border-b border-gray-50 bg-amber-50/40">
                {busy.blocks.slice(0, 3).map((b, i) => (
                  <li key={i} className="flex items-center gap-2 py-0.5 text-[11px] text-gray-500">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                    <span className="truncate">{b.title}</span>
                    {!b.allDay && (
                      <span className="shrink-0 tabular-nums text-gray-400">
                        {new Date(b.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–{new Date(b.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </li>
                ))}
                {busy.blocks.length > 3 && (
                  <li className="py-0.5 text-[10px] text-gray-400">+{busy.blocks.length - 3} more</li>
                )}
              </ul>
            )}
            <ul className="divide-y divide-gray-50">
              {day.tasks.map((task, i) => (
                <li
                  key={i}
                  className={cn('flex items-start gap-3 px-4 py-2.5', task.url && 'cursor-pointer hover:bg-gray-50')}
                  onClick={() => task.url && onTaskNavigate(task.url)}
                >
                  <span className="mt-0.5 shrink-0">{taskIcon(task.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-main">{task.title}</p>
                    <p className="text-[11px] text-gray-400">{task.reason}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">{task.minutes}m</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

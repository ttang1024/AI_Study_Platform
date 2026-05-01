import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, X, FileText, Youtube } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStudy } from '../../context/StudyContext';
import { youtubeService } from '../../services/youtubeService';
import { cn } from '../../utils/cn';

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MAX_VISIBLE = 3;

interface CalendarEntry {
  id: string;
  name: string;
  type: 'doc' | 'article' | 'audio' | 'video';
  courseId?: string;
  courseColor?: string;
}

const entryPath = (entry: { type: string; id: string }) => {
  if (entry.type === 'video') return `/youtube/${entry.id}`;
  if (entry.type === 'article') return `/articles/${entry.id}`;
  if (entry.type === 'audio') return `/audio/${entry.id}`;
  return `/documents/${entry.id}`;
};

const toLocalDateStr = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const StudyCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { documents, courses, quizSubmissions } = useStudy();

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() =>
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [today]
  );

  const [calendarDate, setCalendarDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [studyDayMap, setStudyDayMap] = useState<Record<string, CalendarEntry[]>>({});
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Build studyDayMap from documents + videos + quiz submissions
  useEffect(() => {
    let active = true;
    const build = async () => {
      const map: Record<string, Map<string, CalendarEntry>> = {};
      const addEntry = (date: string, entry: CalendarEntry) => {
        if (!map[date]) map[date] = new Map();
        map[date].set(entry.id, entry);
      };

      // Documents (split by subtype)
      documents.forEach(doc => {
        if (!doc.uploadDate) return;
        const type = doc.type === 'audio' || doc.type === 'podcast' ? 'audio' : doc.originalUrl ? 'article' : 'doc';
        addEntry(toLocalDateStr(doc.uploadDate), { id: doc.id, name: doc.name, type, courseId: doc.courseId });
      });

      // Quiz activity
      quizSubmissions.forEach(s => {
        const doc = documents.find(d => d.id === s.documentId);
        if (doc) addEntry(toLocalDateStr(s.submittedAt), { id: doc.id, name: doc.name, type: 'doc', courseId: doc.courseId });
      });

      // Videos
      try {
        const res = await youtubeService.getVideos({ page: 1, pageSize: 100 });
        (res?.items ?? []).forEach(v => {
          if (v.createdAt)
            addEntry(toLocalDateStr(v.createdAt), { id: v.id, name: v.title, type: 'video', courseId: v.courseId, courseColor: v.courseColor });
        });
      } catch { /* ignore */ }

      if (!active) return;
      const finalMap: Record<string, CalendarEntry[]> = {};
      Object.entries(map).forEach(([date, m]) => { finalMap[date] = Array.from(m.values()); });
      setStudyDayMap(finalMap);
    };
    build();
    return () => { active = false; };
  }, [documents, quizSubmissions]);

  // Close popup on outside click
  useEffect(() => {
    if (!popupDate) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopupDate(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popupDate]);

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const popupDocs = popupDate ? (studyDayMap[popupDate] ?? []) : [];
  const popupDateLabel = popupDate
    ? new Date(popupDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <>
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-text-main">{MONTHS[month]} {year}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
              className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100 hover:text-text-main transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-lg px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 transition-all"
            >
              Today
            </button>
            <button
              onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
              className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100 hover:text-text-main transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-[var(--border-color)]">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return (
              <div
                key={`e-${i}`}
                className={cn('min-h-[72px] border-b border-r border-[var(--border-color)] bg-zinc-50/30', i % 7 === 6 && 'border-r-0')}
              />
            );

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entries = studyDayMap[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const overflow = entries.length - MAX_VISIBLE;

            return (
              <div
                key={dateStr}
                className={cn(
                  'min-h-[72px] p-1.5 border-b border-r border-[var(--border-color)] flex flex-col gap-0.5 transition-colors',
                  i % 7 === 6 && 'border-r-0',
                  isFuture && 'opacity-40',
                  !isFuture && entries.length > 0 && 'bg-primary/[0.03]',
                )}
              >
                <span className={cn(
                  'text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                  isToday ? 'bg-primary text-white' : 'text-text-main',
                )}>
                  {day}
                </span>
                {entries.slice(0, MAX_VISIBLE).map((entry) => {
                  const courseColor = entry.type === 'video'
                    ? (entry.courseColor ?? '#ef4444')
                    : courses.find(c => c.id === entry.courseId)?.color;
                  const bgColor = entry.type === 'video'
                    ? 'rgba(239,68,68,0.12)'
                    : courseColor ? `${courseColor}22` : 'rgba(99,102,241,0.1)';
                  const textColor = courseColor ?? (entry.type === 'video' ? '#ef4444' : 'var(--primary)');
                  return (
                    <button
                      key={entry.id}
                      onClick={() => navigate(entryPath(entry))}
                      className="truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight text-left hover:opacity-75 transition-opacity"
                      style={{ backgroundColor: bgColor, color: textColor }}
                      title={entry.name}
                    >
                      {entry.name}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => setPopupDate(dateStr)}
                    className="rounded px-1 py-0.5 text-[9px] font-bold text-left text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup */}
      <AnimatePresence>
        {popupDate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                ref={popupRef}
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="w-full max-w-xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    <span className="font-bold text-sm text-text-main">{popupDateLabel}</span>
                  </div>
                  <button
                    onClick={() => setPopupDate(null)}
                    className="rounded-lg p-1 text-text-muted hover:bg-zinc-100 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-3 flex flex-col gap-1 max-h-72 overflow-y-auto">
                  {popupDocs.map((entry) => {
                    const course = courses.find(c => c.id === entry.courseId);
                    const courseColor = course?.color ?? (entry.type === 'video' ? '#ef4444' : undefined);
                    const courseName = course?.name;
                    const Icon = entry.type === 'video' ? Youtube : FileText;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => { setPopupDate(null); navigate(entryPath(entry)); }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors group"
                      >
                        <div
                          className="rounded-lg p-1.5 shrink-0"
                          style={courseColor
                            ? { backgroundColor: `${courseColor}20`, color: courseColor }
                            : { backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-main truncate group-hover:text-primary transition-colors">{entry.name}</p>
                          {courseName
                            ? <p className="text-[10px] font-medium truncate" style={{ color: courseColor ?? 'var(--text-muted)' }}>{courseName}</p>
                            : <p className="text-[10px] text-text-muted capitalize">{entry.type}</p>
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

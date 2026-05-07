import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Check, Pencil, Trash2, Loader2, Ban } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useStudy } from '../../context/StudyContext';

interface CoursePickerProps {
  selectedCourseId: string;
  onSelect: (id: string) => void;
  /** Show "Please select a course" hint */
  error?: boolean;
  variant?: 'primary' | 'red';
}

export const CoursePicker: React.FC<CoursePickerProps> = ({
  selectedCourseId,
  onSelect,
  error = false,
  variant = 'primary',
}) => {
  const { courses, addCourse, updateCourse, deleteCourse, courseMaterialCounts } = useStudy();

  // New course form
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#059669');
  const [savingNew, setSavingNew] = useState(false);

  // Edit course form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#059669');
  const [savingEdit, setSavingEdit] = useState(false);

  // Pending delete (requires a second click to confirm)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Checking / blocked delete state
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);
  const [blockInfo, setBlockInfo] = useState<{ courseId: string; message: string } | null>(null);

  // Variant-based classes
  const accent = {
    border: variant === 'red' ? 'border-red-200' : 'border-primary/20',
    hoverBorder: variant === 'red' ? 'hover:border-red-200' : 'hover:border-primary/20',
    focusBorder: variant === 'red' ? 'focus:border-red-400' : 'focus:border-primary',
    focusRing: variant === 'red' ? 'focus:ring-red-400/20' : 'focus:ring-primary/20',
    btnBg: variant === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:opacity-90',
    newTileBorder: variant === 'red' ? 'hover:border-red-300 hover:text-red-500' : 'hover:border-primary/40 hover:text-primary',
    newTileIcon: variant === 'red' ? 'group-hover:bg-red-50' : 'group-hover:bg-primary/10',
  };

  const handleSaveNew = async () => {
    if (!newCourseName.trim()) return;
    setSavingNew(true);
    try {
      await addCourse(newCourseName.trim(), newCourseColor);
      setNewCourseName('');
      setNewCourseColor('#059669');
      setShowNewCourse(false);
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
    setPendingDeleteId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateCourse(editingId, editName.trim(), editColor);
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Second click — confirmed
    if (pendingDeleteId === id) {
      await deleteCourse(id);
      if (selectedCourseId === id) onSelect('');
      setPendingDeleteId(null);
      return;
    }

    // First click — validate before showing confirm state
    setCheckingDeleteId(id);
    setBlockInfo(null);
    try {
      const counts = courseMaterialCounts.find(c => c.courseId === id);
      const docCount = (counts?.documents ?? 0) + (counts?.articles ?? 0) + (counts?.audio ?? 0);
      const videoCount = counts?.videos ?? 0;

      if (docCount > 0 || videoCount > 0) {
        const parts: string[] = [];
        if (docCount > 0) parts.push(`${docCount} document${docCount !== 1 ? 's' : ''}`);
        if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`);
        setBlockInfo({ courseId: id, message: `Has ${parts.join(' & ')} — remove them first` });
        setTimeout(() => setBlockInfo(b => b?.courseId === id ? null : b), 3500);
        return;
      }

      setPendingDeleteId(id);
    } finally {
      setCheckingDeleteId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      {/* Label row */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-400">
            Target Course
          </label>
          <div className="h-1 w-1 rounded-full bg-zinc-300" />
          <span className="text-[10px] font-bold uppercase tracking-tighter text-red-500">
            Required
          </span>
        </div>
        {error && (
          <span className="text-[11px] font-bold text-red-500">Select one</span>
        )}
      </div>

      {/* Vertical course list */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {courses.map((course) => {
          const isActive = selectedCourseId === course.id;
          const isEditing = editingId === course.id;
          const isPendingDelete = pendingDeleteId === course.id;
          const isBlocked = blockInfo?.courseId === course.id;

          if (isEditing) {
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn('w-full flex flex-col gap-2 rounded-xl border-2 bg-white p-3', accent.border)}
              >
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') await handleSaveEdit();
                    else if (e.key === 'Escape') setEditingId(null);
                  }}
                  className={cn(
                    'w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-900 outline-none focus:ring-2 transition-all',
                    accent.focusBorder, accent.focusRing,
                  )}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="flex-1 text-[10px] text-zinc-400">Color</span>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editName.trim() || savingEdit}
                    className={cn('flex h-6 w-6 items-center justify-center rounded-full text-white disabled:opacity-40 transition-all', accent.btnBg)}
                  >
                    {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            );
          }

          return (
            <button
              key={course.id}
              onClick={() => { onSelect(course.id); setPendingDeleteId(null); }}
              className={cn(
                'group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[52px] transition-all duration-300 overflow-hidden text-left',
                isActive ? 'shadow-lg' : 'bg-white hover:bg-zinc-50',
              )}
              style={{
                color: isActive ? '#fff' : course.color,
                ...(isActive && { backgroundColor: course.color }),
              }}
            >
              {/* Name */}
              <span className={cn(
                'text-sm font-black tracking-tight truncate flex-1',
                isActive ? 'text-white' : course.color,
              )}>
                {course.name}
              </span>

              {/* Edit / Delete controls */}
              <div
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <div
                  onClick={() => startEdit(course.id, course.name, course.color)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full transition-all',
                    isActive
                      ? 'bg-white/20 text-white hover:bg-white/40'
                      : 'bg-zinc-100 text-zinc-400 hover:bg-blue-100 hover:text-blue-500',
                  )}
                  title="Edit course"
                >
                  <Pencil size={11} />
                </div>
                <div
                  onClick={() => handleDelete(course.id)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full transition-all',
                    isBlocked
                      ? 'bg-orange-400 text-white scale-110'
                      : isPendingDelete
                        ? 'bg-red-500 text-white scale-110'
                        : isActive
                          ? 'bg-white/20 text-white hover:bg-red-400'
                          : 'bg-zinc-100 text-zinc-400 hover:bg-red-100 hover:text-red-500',
                  )}
                  title={isPendingDelete ? 'Click again to confirm delete' : 'Delete course'}
                >
                  {checkingDeleteId === course.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : isBlocked
                      ? <Ban size={11} />
                      : <Trash2 size={11} />}
                </div>
              </div>

              {/* Block message */}
              <AnimatePresence>
                {isBlocked && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute inset-x-0 bottom-0 rounded-b-xl bg-orange-400/90 px-2 py-1 text-center text-[9px] font-bold text-white leading-tight"
                    onClick={e => e.stopPropagation()}
                  >
                    {blockInfo!.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}

        {/* New Course row */}
        <AnimatePresence mode="wait">
          {showNewCourse ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn('w-full flex flex-col gap-2 rounded-xl border-2 bg-white p-3', accent.border)}
            >
              <input
                autoFocus
                type="text"
                placeholder="Course name"
                value={newCourseName}
                onChange={e => setNewCourseName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newCourseName.trim()) await handleSaveNew();
                  else if (e.key === 'Escape') { setShowNewCourse(false); setNewCourseName(''); }
                }}
                className={cn(
                  'w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-900 outline-none focus:ring-2 transition-all',
                  accent.focusBorder, accent.focusRing,
                )}
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newCourseColor}
                  onChange={e => setNewCourseColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="flex-1 text-[10px] text-zinc-400">Pick color</span>
                <button
                  onClick={handleSaveNew}
                  disabled={!newCourseName.trim() || savingNew}
                  className={cn('flex h-6 w-6 items-center justify-center rounded-full text-white disabled:opacity-40 transition-all', accent.btnBg)}
                >
                  {savingNew ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                </button>
                <button
                  onClick={() => { setShowNewCourse(false); setNewCourseName(''); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="add"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setShowNewCourse(true)}
              className={cn(
                'group w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-zinc-200 bg-white px-3 py-2.5 min-h-[52px] text-zinc-400 transition-all',
                accent.newTileBorder,
              )}
            >
              <div className={cn('shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-zinc-100 transition-all', accent.newTileIcon)}>
                <Plus size={18} />
              </div>
              <span className="text-sm font-black tracking-tight">New Course</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

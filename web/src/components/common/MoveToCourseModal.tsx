import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderInput, Loader2, GraduationCap } from 'lucide-react';
import { Course } from '../../types';
import { cn } from '../../utils/cn';

interface MoveToCourseModalProps {
  currentCourseId?: string;
  courses: Course[];
  onConfirm: (targetCourseId: string) => Promise<void>;
  onClose: () => void;
  itemName: string;
}

export const MoveToCourseModal: React.FC<MoveToCourseModalProps> = ({
  currentCourseId,
  courses,
  onConfirm,
  onClose,
  itemName,
}) => {
  const [selectedId, setSelectedId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const available = courses.filter(c => c.id !== currentCourseId);

  const handleConfirm = async () => {
    if (!selectedId) return;
    setIsMoving(true);
    try {
      await onConfirm(selectedId);
      onClose();
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={() => !isMoving && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-[var(--bg-sidebar)] p-6 shadow-2xl border border-[var(--border-color)]"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderInput size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-main">Move to Course</h3>
            <p className="text-xs text-text-muted truncate max-w-[200px]">{itemName}</p>
          </div>
        </div>

        {available.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No other courses available.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {available.map(course => (
              <button
                key={course.id}
                onClick={() => setSelectedId(course.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all text-left',
                  selectedId === course.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-[var(--border-color)] bg-[var(--bg-app)] text-text-main hover:border-primary/40',
                )}
              >
                <div
                  className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${course.color}20`, color: course.color }}
                >
                  <GraduationCap size={14} />
                </div>
                <span className="truncate">{course.name}</span>
                {selectedId === course.id && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={isMoving}
            className="flex-1 rounded-2xl border border-[var(--border-color)] py-2.5 text-sm font-semibold text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId || isMoving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isMoving ? <Loader2 size={15} className="animate-spin" /> : <FolderInput size={15} />}
            {isMoving ? 'Moving…' : 'Move'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

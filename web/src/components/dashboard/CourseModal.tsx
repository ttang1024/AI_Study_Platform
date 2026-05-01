import React, { useState } from 'react';
import { X, Plus, Trash2, Palette, Sparkles, Pencil, Check } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { Button } from '../common/Button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/cn';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CourseModal: React.FC<CourseModalProps> = ({ isOpen, onClose }) => {
  const { courses, addCourse, updateCourse, deleteCourse } = useStudy();
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6366F1');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addCourse(newName.trim(), selectedColor);
    setNewName('');
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateCourse(editingId, editName.trim(), editColor);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md rounded-[32px] border border-white/20 bg-white shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Palette size={24} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-zinc-900">Manage Courses</h2>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAdd} className="mb-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Course Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Quantum Mechanics"
                    className="w-full rounded-2xl border-2 border-zinc-100 bg-zinc-50 px-5 py-3.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Theme Color</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-xl border-2 border-zinc-100 p-1 bg-zinc-50"
                      title="Pick a color"
                    />
                    <div
                      className="h-10 w-10 rounded-full border-4 border-white shadow-lg"
                      style={{ backgroundColor: selectedColor, boxShadow: `0 0 20px ${selectedColor}60` }}
                    />
                    <span className="text-sm font-mono text-zinc-500">{selectedColor.toUpperCase()}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full py-4 rounded-2xl shadow-xl shadow-primary/10"
                  disabled={!newName.trim()}
                >
                  <Plus size={20} className="mr-2" />
                  Create New Course
                </Button>
              </form>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Your Courses</h3>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {courses.length} Total
                  </span>
                </div>

                <div className="max-h-[280px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                  {courses.length > 0 ? (
                    courses.map((course) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={course.id}
                        className="rounded-2xl border-2 border-zinc-50 bg-zinc-50/50 hover:border-primary/20 hover:bg-white transition-all"
                      >
                        {editingId === course.id ? (
                          <div className="p-4 space-y-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
                              autoFocus
                            />
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-200 p-1 bg-white"
                              />
                              <div
                                className="h-8 w-8 rounded-full border-2 border-white shadow"
                                style={{ backgroundColor: editColor }}
                              />
                              <span className="text-xs font-mono text-zinc-400">{editColor.toUpperCase()}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={cancelEdit}
                                className="flex-1 rounded-xl border border-zinc-200 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-100 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveEdit}
                                className="flex-1 rounded-xl bg-primary py-1.5 text-xs font-bold text-white hover:opacity-90 transition-all flex items-center justify-center gap-1"
                              >
                                <Check size={12} />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                              <div
                                className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-black shadow-sm"
                                style={{ backgroundColor: course.color }}
                              >
                                {course.name.charAt(0)}
                              </div>
                              <p className="font-bold text-zinc-900 leading-none">{course.name}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => startEdit(course.id, course.name, course.color)}
                                className="rounded-xl p-2.5 text-zinc-300 hover:bg-teal-50 hover:text-teal-500 transition-all"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => deleteCourse(course.id)}
                                className="rounded-xl p-2.5 text-zinc-300 hover:bg-red-50 hover:text-red-500 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 rounded-2xl border-2 border-dashed border-zinc-100">
                      <Sparkles className="mx-auto text-zinc-200 mb-2" size={32} />
                      <p className="text-sm font-medium text-zinc-400">No courses yet. Create one above!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

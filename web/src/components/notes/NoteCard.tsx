import React from 'react';
import { ChevronRight, Calendar, Trash2, Edit3, X, Check, Share2, CheckSquare, Square } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';
import { RichTextEditor } from '../common/RichTextEditor';

interface NoteCardProps {
  title: string;
  courseName: string;
  courseColor: string;
  createdAt: string;
  content: string;
  icon: React.ReactNode;
  viewLabel: string;
  onView?: () => void;
  onShare?: () => void;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  title, courseName, courseColor, createdAt, content, icon, viewLabel, onView, onShare,
  isEditing, editContent, onEditContentChange, onStartEdit, onSave, onCancel, onDelete,
  isSelected, onToggleSelect,
}) => (
  <div className={cn(
    'bg-[var(--bg-sidebar)] rounded-2xl border overflow-hidden shadow-sm transition-all',
    isSelected ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]/40' : 'border-[var(--border-color)]',
  )}>
    <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-zinc-50/50">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSelect}
          title={isSelected ? 'Deselect note' : 'Select note'}
          className={cn(
            'shrink-0 transition-all',
            isSelected ? 'text-[var(--primary)]' : 'text-zinc-300 hover:text-[var(--primary)]',
          )}
        >
          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
        {icon}
        <h3 className="font-bold text-text-main truncate">{title}</h3>
        {courseName && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: courseColor }}>{courseName}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {onShare && (
          <button onClick={onShare} className="p-1.5 text-text-muted hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-all" title="Share note">
            <Share2 size={14} />
          </button>
        )}
        {onView && (
          <button onClick={onView} className="text-xs font-medium text-[var(--primary)] hover:underline flex items-center gap-1">
            {viewLabel} <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
    <div className={cn('p-6 group relative', isEditing ? 'bg-[var(--primary)]/5' : 'hover:bg-zinc-50/30')}>
      {isEditing ? (
        <div className="space-y-4">
          <RichTextEditor content={editContent} onChange={onEditContentChange} placeholder="Edit your note..." />
          <div className="flex gap-2 justify-end">
            <Button onClick={onCancel} variant="outline" size="sm"><X size={14} className="mr-1" />Cancel</Button>
            <Button onClick={onSave} size="sm"><Check size={14} className="mr-1" />Save</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-2">
            <span className="flex items-center gap-1 text-[10px] text-text-muted uppercase tracking-wider font-bold">
              <Calendar size={12} />{new Date(createdAt).toLocaleDateString()}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={onStartEdit} className="p-1.5 text-text-muted hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-all"><Edit3 size={14} /></button>
              <button onClick={onDelete} className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="text-sm text-text-main leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
        </>
      )}
    </div>
  </div>
);

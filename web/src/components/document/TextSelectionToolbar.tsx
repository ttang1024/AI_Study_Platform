import React, { useState } from 'react';
import { MessageSquare, Plus, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useStudy } from '../../context/StudyContext';

interface TextSelectionToolbarProps {
  x: number;
  y: number;
  selectedText: string;
  onClose: () => void;
  onAddNote?: () => void;
  /** External handler: receives the selected text to append to note editor */
  onAddNoteText?: (text: string) => void;
  /** External handler: receives the selected text to prefill AI chat */
  onAskAI?: (text: string) => void;
}

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({
  x, y, selectedText, onClose, onAddNote, onAddNoteText, onAskAI,
}) => {
  const { setAiInput, setNoteInput } = useStudy();
  const [copied, setCopied] = useState(false);

  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI(selectedText);
    } else {
      setAiInput(`${selectedText}`);
    }
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 1000);
  };

  const handleAddNote = () => {
    if (onAddNoteText) {
      onAddNoteText(selectedText);
    } else {
      setNoteInput(selectedText);
      onAddNote?.();
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="fixed z-50 shadow-xl"
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-1">
        <button
          onClick={handleAskAI}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
        >
          <MessageSquare size={14} />
          Ask AI
        </button>
        <div className="h-4 w-px bg-zinc-700" />
        <button
          onClick={handleAddNote}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} />
          Add Note
        </button>
        <div className="h-4 w-px bg-zinc-700" />
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </motion.div>
  );
};

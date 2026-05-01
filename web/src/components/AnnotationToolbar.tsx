import React, { useState } from 'react';

interface Props {
  selectedText: string;
  position: { x: number; y: number };
  onSave: (color: string, note?: string) => void;
  onCreateFlashcard: () => void;
  onClose: () => void;
}

const COLORS = [
  { hex: '#FFFF00', label: 'Yellow' },
  { hex: '#90EE90', label: 'Green' },
  { hex: '#87CEEB', label: 'Blue' },
];

export const AnnotationToolbar: React.FC<Props> = ({
  selectedText,
  position,
  onSave,
  onCreateFlashcard,
  onClose,
}) => {
  const [selectedColor, setSelectedColor] = useState('#FFFF00');
  const [note, setNote] = useState('');

  const handleSave = () => {
    onSave(selectedColor, note.trim() || undefined);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        transform: 'translateX(-50%)',
      }}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl p-4 w-72"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Annotate Selection</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Selected text preview */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-3 line-clamp-2">
        "{selectedText.slice(0, 100)}{selectedText.length > 100 ? '…' : ''}"
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500">Color:</span>
        {COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            title={label}
            onClick={() => setSelectedColor(hex)}
            style={{ backgroundColor: hex }}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              selectedColor === hex
                ? 'border-teal-500 scale-110 shadow-md'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          />
        ))}
      </div>

      {/* Note textarea */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)..."
        rows={2}
        className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-200 mb-3"
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 bg-teal-600 text-white text-xs font-medium py-2 px-3 rounded-lg hover:bg-teal-700 transition-colors"
        >
          Save Highlight
        </button>
        <button
          onClick={onCreateFlashcard}
          className="flex-1 bg-emerald-600 text-white text-xs font-medium py-2 px-3 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Create Flashcard
        </button>
      </div>
    </div>
  );
};

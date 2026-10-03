import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { EDITOR_EXTENSIONS, EditorToolbar } from './editorToolbar';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange }) => {
  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none max-w-none min-h-[120px] p-4 text-sm text-zinc-800',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="w-full rounded-xl border border-[var(--border-color)] overflow-hidden bg-white focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]/20 transition-all">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

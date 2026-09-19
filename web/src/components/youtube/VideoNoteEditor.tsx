import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Check, StickyNote } from 'lucide-react';
import { EDITOR_EXTENSIONS, EditorToolbar } from '../common/editorToolbar';

// ── Public ref type ──────────────────────────────────────────────────────────
export interface VideoNoteEditorRef {
	appendContent: (html: string) => void;
}

// ── Main component ───────────────────────────────────────────────────────────
interface VideoNoteEditorProps {
	videoRecordId: string;
	initialContent?: string;
	onSave?: (html: string) => void;
}

type SaveStatus = 'saved' | 'saving' | 'idle';

export const VideoNoteEditor = React.forwardRef<VideoNoteEditorRef, VideoNoteEditorProps>(
	({ videoRecordId, initialContent = '', onSave }, ref) => {
		const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
		const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const isFirstLoad = useRef(true);

		// Typing and an appended clip both save the same way: debounce, then flash "Saved".
		const onSaveRef = useRef(onSave);
		onSaveRef.current = onSave;
		const scheduleSave = useRef((html: () => string) => {
			setSaveStatus('saving');
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				onSaveRef.current?.(html());
				setSaveStatus('saved');
				setTimeout(() => setSaveStatus('idle'), 1500);
			}, 600);
		}).current;

		const editor = useEditor({
			extensions: EDITOR_EXTENSIONS,
			content: initialContent,
			editorProps: {
				attributes: {
					class: 'prose prose-sm focus:outline-none max-w-none min-h-[200px] p-4 text-sm text-zinc-800',
				},
			},
			onUpdate: ({ editor }) => {
				if (isFirstLoad.current) { isFirstLoad.current = false; return; }
				scheduleSave(() => editor.getHTML());
			},
		});

		// Expose appendContent via ref
		useImperativeHandle(ref, () => ({
			appendContent: (html: string) => {
				if (!editor) return;
				editor.chain().focus('end').insertContent(html).run();
				scheduleSave(() => editor.getHTML());
			},
		}), [editor, scheduleSave]);

		// Tracks which record's content is currently in the editor, so a record switch
		// always reloads while a content-only change is judged on its own merits.
		const loadedRecordRef = useRef<string | null>(null);

		// Reload content when the record changes, and also when the saved note finally
		// arrives: the parent fetches it after this editor has mounted, so the first
		// render usually hands us an empty `initialContent`. Late content is only applied
		// to an untouched (empty) editor — never over something the user has typed, and
		// never on the save round-trip that echoes the current HTML back as initialContent.
		useEffect(() => {
			if (!editor) return;
			const recordChanged = loadedRecordRef.current !== videoRecordId;
			if (!recordChanged && (!initialContent || !editor.isEmpty)) return;
			loadedRecordRef.current = videoRecordId;
			isFirstLoad.current = true;
			editor.commands.setContent(initialContent);
		}, [videoRecordId, initialContent, editor]);

		useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

		if (!editor) return null;

		return (
			<div className="flex flex-col h-full">
				<EditorToolbar editor={editor} className="shrink-0">
					<div className="ml-auto text-[10px] font-medium transition-opacity">
						{saveStatus === 'saving' && <span className="text-zinc-400">Saving…</span>}
						{saveStatus === 'saved' && <span className="text-emerald-500 flex items-center gap-1"><Check size={10} /> Saved</span>}
					</div>
				</EditorToolbar>

				{/* Editor */}
				<div className="flex-1 overflow-y-auto bg-white">
					{editor.isEmpty && (
						<div className="pointer-events-none absolute px-4 pt-4 text-sm text-zinc-400 flex items-center gap-2">
							<StickyNote size={14} /> Start typing your notes…
						</div>
					)}
					<EditorContent editor={editor} className="h-full" />
				</div>
			</div>
		);
	}
);

VideoNoteEditor.displayName = 'VideoNoteEditor';

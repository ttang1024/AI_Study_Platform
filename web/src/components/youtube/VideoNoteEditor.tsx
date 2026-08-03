import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import {
	Bold, Italic, List, ListOrdered,
	ChevronDown, Check, Palette, StickyNote,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { ToolbarBtn } from '../common/RichTextEditor';

// ── Custom FontSize extension ────────────────────────────────────────────────
const FontSize = Extension.create({
	name: 'fontSize',
	addOptions() { return { types: ['textStyle'] }; },
	addGlobalAttributes() {
		return [{
			types: this.options.types,
			attributes: {
				fontSize: {
					default: null,
					parseHTML: el => el.style.fontSize || null,
					renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
				},
			},
		}];
	},
	addCommands() {
		return {
			setFontSize: (size: string) => ({ chain }: any) =>
				chain().setMark('textStyle', { fontSize: size }).run(),
			unsetFontSize: () => ({ chain }: any) =>
				chain().setMark('textStyle', { fontSize: null }).run(),
		} as any;
	},
});

// ── Color palette ────────────────────────────────────────────────────────────
const COLOR_PALETTE = [
	'#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
	'#ff0000', '#ff4500', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
	'#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
	'#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#cc4125', '#e06666', '#f6b26b', '#ffd966',
	'#93c47d', '#76a5af', '#6fa8dc', '#6d9eeb', '#8e7cc3', '#c27ba0', '#a61c00', '#cc0000',
	'#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c8', '#674ea7', '#a64d79',
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];


// ── Sub-components ───────────────────────────────────────────────────────────

function FontSizePicker({ editor }: { editor: any }) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const current = editor?.getAttributes('textStyle')?.fontSize ?? '14px';

	useEffect(() => {
		const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	return (
		<div ref={ref} className="relative">
			<button
				onMouseDown={e => { e.preventDefault(); setOpen(v => !v); }}
				className="flex h-7 items-center gap-0.5 rounded-md px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
				title="Font size"
			>
				{current.replace('px', '')}
				<ChevronDown size={11} />
			</button>
			{open && (
				<div className="absolute left-0 top-8 z-50 w-20 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
					{FONT_SIZES.map(size => (
						<button
							key={size}
							onMouseDown={e => {
								e.preventDefault();
								(editor.chain().focus() as any).setFontSize(size).run();
								setOpen(false);
							}}
							className={cn(
								'flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-zinc-50 transition-colors',
								current === size ? 'font-semibold text-[var(--primary)]' : 'text-zinc-700',
							)}
						>
							<span style={{ fontSize: size }}>{size.replace('px', '')}</span>
							{current === size && <Check size={11} />}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function ColorPicker({ editor }: { editor: any }) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const current = editor?.getAttributes('textStyle')?.color;

	useEffect(() => {
		const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	return (
		<div ref={ref} className="relative">
			<button
				onMouseDown={e => { e.preventDefault(); setOpen(v => !v); }}
				title="Text color"
				className="flex h-7 w-7 flex-col items-center justify-center gap-0.5 rounded-md hover:bg-zinc-100 transition-colors"
			>
				<Palette size={14} className="text-zinc-500" />
				<span
					className="h-1 w-4 rounded-full"
					style={{ backgroundColor: current || '#000000' }}
				/>
			</button>
			{open && (
				<div className="absolute left-0 top-8 z-50 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
					<div className="grid grid-cols-8 gap-1">
						{COLOR_PALETTE.map(color => (
							<button
								key={color}
								onMouseDown={e => {
									e.preventDefault();
									editor.chain().focus().setColor(color).run();
									setOpen(false);
								}}
								title={color}
								className={cn(
									'h-5 w-5 rounded-sm border border-zinc-200 transition-transform hover:scale-110',
									current === color && 'ring-2 ring-[var(--primary)] ring-offset-1',
								)}
								style={{ backgroundColor: color }}
							/>
						))}
					</div>
					<div className="mt-2 border-t border-zinc-100 pt-2">
						<button
							onMouseDown={e => {
								e.preventDefault();
								editor.chain().focus().unsetColor().run();
								setOpen(false);
							}}
							className="w-full rounded-lg px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
						>
							Reset color
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

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

		const editor = useEditor({
			extensions: [StarterKit, TextStyle, Color, FontSize],
			content: initialContent,
			editorProps: {
				attributes: {
					class: 'prose prose-sm focus:outline-none max-w-none min-h-[200px] p-4 text-sm text-zinc-800',
				},
			},
			onUpdate: ({ editor }) => {
				if (isFirstLoad.current) { isFirstLoad.current = false; return; }
				setSaveStatus('saving');
				if (debounceRef.current) clearTimeout(debounceRef.current);
				debounceRef.current = setTimeout(() => {
					onSave?.(editor.getHTML());
					setSaveStatus('saved');
					setTimeout(() => setSaveStatus('idle'), 1500);
				}, 600);
			},
		});

		// Expose appendContent via ref
		useImperativeHandle(ref, () => ({
			appendContent: (html: string) => {
				if (!editor) return;
				editor.chain().focus('end').insertContent(html).run();
				setSaveStatus('saving');
				if (debounceRef.current) clearTimeout(debounceRef.current);
				debounceRef.current = setTimeout(() => {
					onSave?.(editor.getHTML());
					setSaveStatus('saved');
					setTimeout(() => setSaveStatus('idle'), 1500);
				}, 600);
			},
		}), [editor, onSave]);

		// Reload content when video changes
		useEffect(() => {
			if (!editor) return;
			isFirstLoad.current = true;
			editor.commands.setContent(initialContent);
		}, [videoRecordId, editor]);

		useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

		if (!editor) return null;

		return (
			<div className="flex flex-col h-full">
				{/* Toolbar */}
				<div className="flex items-center gap-0.5 border-b border-[var(--border-color)] px-3 py-1.5 bg-[var(--bg-sidebar)] shrink-0 flex-wrap">
					<FontSizePicker editor={editor} />
					<div className="w-px h-4 bg-zinc-200 mx-1" />
					<ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
						<Bold size={14} />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
						<Italic size={14} />
					</ToolbarBtn>
					<div className="w-px h-4 bg-zinc-200 mx-1" />
					<ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
						<List size={14} />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
						<ListOrdered size={14} />
					</ToolbarBtn>
					<div className="w-px h-4 bg-zinc-200 mx-1" />
					<ColorPicker editor={editor} />

					{/* Save status */}
					<div className="ml-auto text-[10px] font-medium transition-opacity">
						{saveStatus === 'saving' && <span className="text-zinc-400">Saving…</span>}
						{saveStatus === 'saved' && <span className="text-emerald-500 flex items-center gap-1"><Check size={10} /> Saved</span>}
					</div>
				</div>

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

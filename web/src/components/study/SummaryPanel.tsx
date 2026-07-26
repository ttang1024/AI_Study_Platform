import React from 'react';
import { Sparkles, Loader2, Volume2, VolumeX, Pencil, Check, X } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { useTts } from '../../hooks/useTts';
import { TtsPlayer } from '../common/TtsPlayer';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';
import { SummaryMarkdown } from './SummaryMarkdown';
import TranslateButton from '../common/TranslateButton';

interface SummaryPanelProps {
	summary: string | null;
	isLoading: boolean;
	onGenerate: () => void;
	loadingText?: string;
	emptyText?: string;
	error?: string | null;
	onRetry?: () => void;
	/** Progressive streaming text shown while isLoading is true */
	streamingText?: string;
	/** Forwarded to the summary content div for text-selection handling */
	onMouseUp?: React.MouseEventHandler<HTMLDivElement>;
	summaryRef?: React.RefObject<HTMLDivElement>;
	onTimelineSeek?: (seconds: number) => void;
	generateDisabled?: boolean;
	generateDisabledReason?: string;
	/** When provided, an Edit button lets the user revise the summary markdown in place. */
	onSaveSummary?: (markdown: string) => Promise<void>;
}

const stripMarkdown = (md: string): string =>
	md
		.replace(/#{1,6}\s+/g, '')
		.replace(/\*\*(.+?)\*\*/g, '$1')
		.replace(/\*(.+?)\*/g, '$1')
		.replace(/`(.+?)`/g, '$1')
		.replace(/\[(.+?)\]\(.+?\)/g, '$1')
		.replace(/^[-*]\s+/gm, '')
		.replace(/^\d+\.\s+/gm, '');

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
	summary,
	isLoading,
	onGenerate,
	loadingText = 'AI is analyzing…',
	emptyText = 'Generate an AI summary.',
	error,
	onRetry,
	streamingText,
	onMouseUp,
	summaryRef,
	onTimelineSeek,
	generateDisabled = false,
	generateDisabledReason,
	onSaveSummary,
}) => {
	const [translated, setTranslated] = React.useState<string | null>(null);

	// Drop a translation when the underlying summary changes, so it can never be shown against
	// material it was not translated from.
	React.useEffect(() => setTranslated(null), [summary]);

	const ttsItems = React.useMemo(
		() => summary ? [{ text: stripMarkdown(summary), title: 'Summary' }] : [],
		[summary],
	);
	const { playerState, ttsError, play, pause, resume, stop, clearError } = useTts(ttsItems);

	const [isEditing, setIsEditing] = React.useState(false);
	const [draft, setDraft] = React.useState('');
	const [isSaving, setIsSaving] = React.useState(false);

	const startEditing = () => {
		setDraft(summary ?? '');
		setIsEditing(true);
	};

	const handleSave = async () => {
		if (!onSaveSummary || isSaving) return;
		setIsSaving(true);
		try {
			await onSaveSummary(draft);
			setIsEditing(false);
		} catch {
			// Keep edit mode open so the user doesn't lose their changes on failure.
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading && streamingText) {
		return (
			<div className="summary-content select-text">
				<SummaryMarkdown value={streamingText} onTimelineSeek={onTimelineSeek} />
				<span className="inline-block h-4 w-0.5 animate-pulse bg-[var(--primary)] ml-0.5 align-middle" />
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center">
				<Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
				<p className="text-sm text-zinc-500">{loadingText}</p>
			</div>
		);
	}

	if (error) {
		return <GenerationFailedState message={error} onRetry={onRetry} retryDisabled={generateDisabled} disabledReason={generateDisabledReason} />;
	}

	if (isEditing) {
		return (
			<div className="flex flex-col h-full p-4 gap-3">
				<textarea
					autoFocus
					value={draft}
					onChange={e => setDraft(e.target.value)}
					className="flex-1 min-h-[240px] w-full resize-none rounded-xl border border-[var(--primary)]/40 bg-[var(--bg-app)] p-3 text-sm text-text-main outline-none focus:border-[var(--primary)] font-mono leading-relaxed"
					placeholder="Edit the summary (markdown supported)…"
				/>
				<div className="flex justify-end gap-2">
					<button
						onClick={() => setIsEditing(false)}
						disabled={isSaving}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:bg-zinc-100 transition-all border border-[var(--border-color)] disabled:opacity-50"
					>
						<X size={13} /> Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving || !draft.trim()}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--primary)] hover:opacity-90 transition-all disabled:opacity-50"
					>
						{isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
					</button>
				</div>
			</div>
		);
	}

	if (summary) {
		return (
			<>
				<div className="flex justify-end items-center gap-2 mt-2 mr-2">
					{onSaveSummary && (
						<button
							onClick={startEditing}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:bg-zinc-100 transition-all border border-[var(--border-color)]"
							title="Edit summary"
						>
							<Pencil size={13} /> Edit
						</button>
					)}
					<button
						onClick={() => playerState === 'idle' ? play(0) : stop()}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all border border-[var(--primary)]/20"
						title={playerState === 'idle' ? 'Listen to summary' : 'Stop playback'}
					>
						{playerState === 'loading' ? (
							<Loader2 size={13} className="animate-spin" />
						) : playerState === 'idle' ? (
							<Volume2 size={13} />
						) : (
							<VolumeX size={13} />
						)}
						{playerState === 'idle' ? 'Listen' : playerState === 'loading' ? 'Loading…' : 'Stop'}
					</button>
				</div>
				<div
					ref={summaryRef}
					className="summary-content select-text"
					onMouseUp={onMouseUp}
				>
					<SummaryMarkdown value={translated ?? summary} onTimelineSeek={onTimelineSeek} />
				</div>
				{/* Translation is a view over the summary, held in local state only — nothing is saved,
				    so a regenerated summary can never leave a stale translation behind. */}
				<TranslateButton text={summary} onTranslated={setTranslated} className="mt-3" />
				{(playerState !== 'idle' || ttsError) && (
					<TtsPlayer
						state={playerState}
						title="Summary"
						onPlay={resume}
						onPause={pause}
						onStop={stop}
						error={ttsError?.message}
						onDismissError={clearError}
					/>
				)}
			</>
		);
	}

	return (
		<EmptyGenerationState
			icon={Sparkles}
			title="No Summary Yet"
			description={emptyText}
			actionLabel="Generate Summary"
			onAction={onGenerate}
			actionDisabled={generateDisabled}
			disabledReason={generateDisabledReason}
		/>
	);
};

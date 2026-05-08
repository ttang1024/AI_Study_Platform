import React from 'react';
import { Sparkles, Loader2, Volume2, VolumeX } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { useTts } from '../../hooks/useTts';
import { TtsPlayer } from '../common/TtsPlayer';
import { TtsKeyPrompt } from '../common/TtsKeyPrompt';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';
import { SummaryMarkdown } from './SummaryMarkdown';

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
}) => {
	const ttsItems = React.useMemo(
		() => summary ? [{ text: stripMarkdown(summary), title: 'Summary' }] : [],
		[summary],
	);
	const { playerState, ttsError, play, pause, resume, stop, clearError, switchToBrowser } = useTts(ttsItems);

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

	if (summary) {
		return (
			<>
				<div className="flex justify-end mt-2 mr-2">
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
					<SummaryMarkdown value={summary} onTimelineSeek={onTimelineSeek} />
				</div>
				{ttsError?.code === 'no_key' && (
					<TtsKeyPrompt
						onSaved={() => { clearError(); play(0); }}
						onDismiss={clearError}
						onUseBrowser={() => switchToBrowser(0)}
					/>
				)}
				{(playerState !== 'idle' || (ttsError && ttsError.code !== 'no_key')) && (
					<TtsPlayer
						state={playerState}
						title="Summary"
						onPlay={resume}
						onPause={pause}
						onStop={stop}
						error={ttsError?.code !== 'no_key' ? ttsError?.message : null}
						errorCode={ttsError?.code}
						onDismissError={clearError}
						onUseBrowserTts={() => switchToBrowser()}
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

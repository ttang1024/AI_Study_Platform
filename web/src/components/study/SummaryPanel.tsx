import React from 'react';
import { Sparkles, AlertCircle, RotateCcw, Loader2, Volume2, VolumeX } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useTts } from '../../hooks/useTts';
import { TtsPlayer } from '../common/TtsPlayer';
import { TtsKeyPrompt } from '../common/TtsKeyPrompt';

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
}

const markdownComponents = {
	h1: ({ children }: any) => <h1 className="summary-h1">{children}</h1>,
	h2: ({ children }: any) => <h2 className="summary-h2">{children}</h2>,
	h3: ({ children }: any) => <h3 className="summary-h3">{children}</h3>,
	p: ({ children }: any) => <p className="summary-p">{children}</p>,
	ul: ({ children }: any) => <ul className="summary-ul">{children}</ul>,
	li: ({ children }: any) => <li className="summary-li">{children}</li>,
	strong: ({ children }: any) => <strong className="summary-strong">{children}</strong>,
};

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
}) => {
	const ttsItems = React.useMemo(
		() => summary ? [{ text: stripMarkdown(summary), title: 'Summary' }] : [],
		[summary],
	);
	const { playerState, ttsError, play, pause, resume, stop, clearError, switchToBrowser } = useTts(ttsItems);

	if (isLoading && streamingText) {
		return (
			<div className="summary-content select-text">
				<ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>{streamingText}</ReactMarkdown>
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
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center gap-5 px-6">
				<div className="rounded-2xl bg-red-500/10 p-4 text-red-500">
					<AlertCircle size={28} />
				</div>
				<div>
					<h3 className="text-sm font-bold text-text-main">Generation Failed</h3>
					<p className="mt-1 text-[11px] text-zinc-400 max-w-[220px]">{error}</p>
				</div>
				{onRetry && (
					<button
						onClick={onRetry}
						className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:opacity-90 transition-opacity"
					>
						<RotateCcw size={13} />
						Retry
					</button>
				)}
			</div>
		);
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
					<ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>{summary}</ReactMarkdown>
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
		<div className="flex flex-col items-center justify-center py-12 text-center gap-5 px-6">
			<div className="rounded-2xl bg-[var(--primary)]/10 p-4 text-[var(--primary)]">
				<Sparkles size={28} />
			</div>
			<div>
				<h3 className="text-sm font-bold text-text-main">No Summary Yet</h3>
				<p className="mt-1 text-sm text-zinc-500">{emptyText}</p>
			</div>
			<button
				onClick={onGenerate}
				className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:opacity-90 transition-opacity"
			>
				<Sparkles size={13} />
				Generate Summary
			</button>
		</div>
	);
};

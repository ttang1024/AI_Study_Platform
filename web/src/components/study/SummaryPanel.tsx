import React from 'react';
import { Sparkles, Loader2, Volume2, VolumeX } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useTts } from '../../hooks/useTts';
import { TtsPlayer } from '../common/TtsPlayer';
import { TtsKeyPrompt } from '../common/TtsKeyPrompt';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';

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

const timelineRangePattern = /^\s*(?:[-*]\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/;

const getTextFromChildren = (children: React.ReactNode): string => {
	if (typeof children === 'string' || typeof children === 'number') return String(children);
	if (Array.isArray(children)) return children.map(getTextFromChildren).join('');
	if (React.isValidElement<{ children?: React.ReactNode }>(children)) return getTextFromChildren(children.props.children);
	return '';
};

const parseTimestamp = (value: string): number => {
	const parts = value.split(':').map(Number);
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	return parts[0] * 60 + parts[1];
};

const formatTimestamp = (seconds: number): string => {
	const safe = Math.max(0, Math.floor(seconds));
	const h = Math.floor(safe / 3600);
	const m = Math.floor((safe % 3600) / 60);
	const s = safe % 60;
	return h > 0
		? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
		: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const cleanTimelineBody = (body: string): string => body.replace(/^\s*[:\-–]\s*/, '').trim();

const TimelineParagraph: React.FC<{
	startLabel: string;
	endLabel: string;
	body: string;
	onSeek: (seconds: number) => void;
}> = ({ startLabel, endLabel, body, onSeek }) => {
	const startSeconds = parseTimestamp(startLabel);
	const endSeconds = Math.max(startSeconds, parseTimestamp(endLabel));
	const [value, setValue] = React.useState(startSeconds);

	React.useEffect(() => {
		setValue(startSeconds);
	}, [startSeconds, endSeconds]);

	const progress = endSeconds > startSeconds
		? ((value - startSeconds) / (endSeconds - startSeconds)) * 100
		: 0;

	const handleSeek = (nextValue: number) => {
		setValue(nextValue);
		onSeek(nextValue);
	};

	return (
		<div className="summary-timeline-item">
			<div className="summary-timeline-head">
				<button
					type="button"
					onClick={() => handleSeek(startSeconds)}
					className="summary-timeline-range"
					title="Jump to this timeline segment"
				>
					{startLabel} – {endLabel}
				</button>
				<span className="summary-timeline-current">{formatTimestamp(value)}</span>
			</div>
			<input
				type="range"
				min={startSeconds}
				max={endSeconds}
				step={1}
				value={value}
				onChange={(event) => handleSeek(Number(event.target.value))}
				className="summary-timeline-slider"
				style={{ ['--timeline-progress' as string]: `${progress}%` }}
				aria-label={`Seek within ${startLabel} to ${endLabel}`}
			/>
			<p className="summary-p mt-2">{cleanTimelineBody(body)}</p>
		</div>
	);
};

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
	const renderTimelineText = React.useCallback((children: React.ReactNode, fallback: (children: React.ReactNode) => React.ReactNode) => {
		const text = getTextFromChildren(children);
		const match = onTimelineSeek ? text.match(timelineRangePattern) : null;
		if (match) {
			return (
				<TimelineParagraph
					startLabel={match[1]}
					endLabel={match[2]}
					body={match[3]}
					onSeek={onTimelineSeek}
				/>
			);
		}
		return fallback(children);
	}, [onTimelineSeek]);

	const markdownComponentsWithTimeline = React.useMemo(() => ({
		...markdownComponents,
		p: ({ children }: any) => renderTimelineText(children, (node) => <p className="summary-p">{node}</p>),
		li: ({ children }: any) => renderTimelineText(children, (node) => <li className="summary-li">{node}</li>),
	}), [renderTimelineText]);

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
					<ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponentsWithTimeline}>{summary}</ReactMarkdown>
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

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface SummaryMarkdownProps {
	value: string;
	onTimelineSeek?: (seconds: number) => void;
}

export const summaryMarkdownComponents = {
	h1: ({ children }: any) => <h1 className="summary-h1">{children}</h1>,
	h2: ({ children }: any) => <h2 className="summary-h2">{children}</h2>,
	h3: ({ children }: any) => <h3 className="summary-h3">{children}</h3>,
	p: ({ children }: any) => <p className="summary-p">{children}</p>,
	ul: ({ children }: any) => <ul className="summary-ul">{children}</ul>,
	ol: ({ children }: any) => <ol className="summary-ul list-decimal">{children}</ol>,
	li: ({ children }: any) => <li className="summary-li">{children}</li>,
	strong: ({ children }: any) => <strong className="summary-strong">{children}</strong>,
	blockquote: ({ children }: any) => <blockquote className="border-l-4 border-primary/30 pl-4 italic text-text-muted">{children}</blockquote>,
	code: ({ inline, children }: any) => inline
		? <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-text-main">{children}</code>
		: <code className="block overflow-x-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">{children}</code>,
	pre: ({ children }: any) => <pre className="my-3 overflow-x-auto rounded-xl bg-zinc-950">{children}</pre>,
	table: ({ children }: any) => <div className="my-3 overflow-x-auto"><table className="min-w-full border-collapse text-sm">{children}</table></div>,
	th: ({ children }: any) => <th className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-bold">{children}</th>,
	td: ({ children }: any) => <td className="border border-zinc-200 px-3 py-2 align-top">{children}</td>,
};

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
	onSeek?: (seconds: number) => void;
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
		onSeek?.(nextValue);
	};

	return (
		<div className="summary-timeline-item">
			<div className="summary-timeline-head">
				<button
					type="button"
					onClick={() => handleSeek(startSeconds)}
					disabled={!onSeek}
					className="summary-timeline-range"
					title={onSeek ? 'Jump to this timeline segment' : undefined}
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
				disabled={!onSeek}
				onChange={(event) => handleSeek(Number(event.target.value))}
				className="summary-timeline-slider"
				style={{ ['--timeline-progress' as string]: `${progress}%` }}
				aria-label={`Seek within ${startLabel} to ${endLabel}`}
			/>
			<p className="summary-p mt-2">{cleanTimelineBody(body)}</p>
		</div>
	);
};

export const SummaryMarkdown: React.FC<SummaryMarkdownProps> = ({ value, onTimelineSeek }) => {
	const renderTimelineText = React.useCallback((children: React.ReactNode, fallback: (children: React.ReactNode) => React.ReactNode) => {
		const text = getTextFromChildren(children);
		const match = text.match(timelineRangePattern);
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

	const components = React.useMemo(() => ({
		...summaryMarkdownComponents,
		p: ({ children }: any) => renderTimelineText(children, (node) => <p className="summary-p">{node}</p>),
		li: ({ children }: any) => renderTimelineText(children, (node) => <li className="summary-li">{node}</li>),
	}), [renderTimelineText]);

	return (
		<ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
			{value}
		</ReactMarkdown>
	);
};

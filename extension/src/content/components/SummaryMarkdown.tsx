import { useEffect, useState } from 'react'
import { Markdown } from './Markdown'
import { fmtTime, seekTo } from '../../lib/util'

// Mirrors the web app's Timeline Summary (web/src/components/study/SummaryMarkdown.tsx):
// lines shaped like "00:00 – 02:30 description" become interactive cards with a
// clickable range button (seeks the YouTube player), a live position readout and
// a scrub slider. Everything else falls through to the normal markdown renderer.
const TIMELINE_RE = /^\s*(?:[-*]\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/

function parseTs(value: string): number {
	const parts = value.split(':').map(Number)
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
	return parts[0] * 60 + parts[1]
}

const cleanBody = (body: string): string => body.replace(/^\s*[:\-–]\s*/, '').trim()

type Block =
	| { kind: 'md'; text: string }
	| { kind: 'timeline'; start: string; end: string; body: string }

function splitBlocks(text: string): Block[] {
	const blocks: Block[] = []
	let buffer: string[] = []
	const flush = () => {
		const md = buffer.join('\n').trim()
		if (md) blocks.push({ kind: 'md', text: md })
		buffer = []
	}
	for (const line of text.split('\n')) {
		const m = line.match(TIMELINE_RE)
		if (m) {
			flush()
			blocks.push({ kind: 'timeline', start: m[1], end: m[2], body: m[3] })
		} else {
			buffer.push(line)
		}
	}
	flush()
	return blocks
}

function TimelineItem({ start, end, body }: { start: string; end: string; body: string }) {
	const startSeconds = parseTs(start)
	const endSeconds = Math.max(startSeconds, parseTs(end))
	const [value, setValue] = useState(startSeconds)

	useEffect(() => {
		setValue(startSeconds)
	}, [startSeconds, endSeconds])

	const progress = endSeconds > startSeconds ? ((value - startSeconds) / (endSeconds - startSeconds)) * 100 : 0
	const text = cleanBody(body)

	return (
		<div className="es-tl-item">
			<div className="es-tl-head">
				<button
					type="button"
					className="es-tl-range"
					title="Jump to this timeline segment"
					onClick={() => {
						setValue(startSeconds)
						seekTo(startSeconds)
					}}
				>
					{start} – {end}
				</button>
				<span className="es-tl-current">{fmtTime(value)}</span>
			</div>
			<input
				type="range"
				className="es-tl-slider"
				min={startSeconds}
				max={endSeconds}
				step={1}
				value={value}
				onChange={(e) => setValue(Number(e.target.value))}
				onMouseUp={(e) => seekTo(Number(e.currentTarget.value))}
				onTouchEnd={(e) => seekTo(Number(e.currentTarget.value))}
				style={{ background: `linear-gradient(to right, #059669 0%, #059669 ${progress}%, #e4e4e7 ${progress}%, #e4e4e7 100%)` }}
				aria-label={`Seek within ${start} to ${end}`}
			/>
			{text && <p className="es-tl-body">{text}</p>}
		</div>
	)
}

export function SummaryMarkdown({ text }: { text: string }) {
	const blocks = splitBlocks(text)
	return (
		<>
			{blocks.map((b, i) =>
				b.kind === 'timeline' ? (
					<TimelineItem key={i} start={b.start} end={b.end} body={b.body} />
				) : (
					<Markdown key={i} text={b.text} className="" />
				),
			)}
		</>
	)
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loading } from '../components/Spinner'
import { fmtTime, seekTo, videoEl, copyText } from '../../lib/util'
import type { Captions } from '../hooks'

interface Props {
	transcript: Captions
}

export function TranscriptTab({ transcript }: Props) {
	const { segments, loading, error, ensureLoaded } = transcript

	const [filter, setFilter] = useState('')
	const [activeIdx, setActiveIdx] = useState(-1)
	const listRef = useRef<HTMLDivElement>(null)

	// Lazily load whichever view is on screen.
	useEffect(() => {
		ensureLoaded()
	}, [ensureLoaded])

	// Highlight the line matching the player's current time.
	useEffect(() => {
		if (!segments) return
		const tick = () => {
			const v = videoEl()
			if (!v) return
			const now = v.currentTime
			let idx = -1
			for (let i = 0; i < segments.length; i++) {
				if (segments[i].startSeconds <= now + 0.25) idx = i
				else break
			}
			setActiveIdx(idx)
		}
		const t = window.setInterval(tick, 1000)
		tick()
		return () => clearInterval(t)
	}, [segments])

	const rows = useMemo(() => {
		if (!segments) return []
		const q = filter.trim().toLowerCase()
		return segments
			.map((s, i) => ({ s, i }))
			.filter(({ s }) => !q || s.text.toLowerCase().includes(q))
	}, [segments, filter])

	const copyAll = () => {
		if (!segments) return
		copyText(segments.map((s) => `[${fmtTime(s.startSeconds)}] ${s.text}`).join('\n'))
	}

	return (
		<div className="es-pane">
			<div className="es-toolbar">
				<input
					className="es-search"
					type="search"
					placeholder="Search transcript…"
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
				/>
				<button className="es-btn es-btn-ghost" onClick={copyAll} disabled={!segments?.length}>
					⧉ Copy
				</button>
			</div>
			<div className="es-transcript es-scroll" ref={listRef}>
				{loading ? (
					<Loading label="Loading transcript…" />
				) : error ? (
					<div className="es-error">{error}</div>
				) : rows.length === 0 ? (
					<div className="es-empty">
						{filter ? 'No matches.' : 'No transcript available.'}
					</div>
				) : (
					rows.map(({ s, i }) => (
						<div
							key={i}
							className={'es-seg' + (i === activeIdx ? ' active' : '')}
							onClick={() => seekTo(s.startSeconds)}
						>
							<span className="es-seg-time">{fmtTime(s.startSeconds)}</span>
							<Highlighted text={s.text} query={filter.trim()} />
						</div>
					))
				)}
			</div>
		</div>
	)
}

function Highlighted({ text, query }: { text: string; query: string }) {
	if (!query) return <span className="es-seg-text">{text}</span>
	const i = text.toLowerCase().indexOf(query.toLowerCase())
	if (i < 0) return <span className="es-seg-text">{text}</span>
	return (
		<span className="es-seg-text">
			{text.slice(0, i)}
			<mark>{text.slice(i, i + query.length)}</mark>
			{text.slice(i + query.length)}
		</span>
	)
}

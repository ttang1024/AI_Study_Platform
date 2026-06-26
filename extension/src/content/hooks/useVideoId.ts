import { useEffect, useState } from 'react'
import { getVideoId } from '../../lib/util'

// ── current YouTube video id (SPA-aware) ────────────────────────────────────
export function useVideoId(): string | null {
	const [id, setId] = useState<string | null>(() => getVideoId())
	useEffect(() => {
		const update = () => setId(getVideoId())
		window.addEventListener('yt-navigate-finish', update)
		let lastHref = location.href
		const timer = window.setInterval(() => {
			if (location.href !== lastHref) {
				lastHref = location.href
				update()
			}
		}, 800)
		return () => {
			window.removeEventListener('yt-navigate-finish', update)
			clearInterval(timer)
		}
	}, [])
	return id
}

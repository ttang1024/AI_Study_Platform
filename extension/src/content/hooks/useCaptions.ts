import { useCallback, useEffect, useState } from 'react'
import { send, type TranscriptSegment } from '../../lib/messaging'

// ── captions (transcript) ────────────────────────────────────────────────────
export interface Captions {
	segments: TranscriptSegment[] | null
	loading: boolean
	error: string | null
	ensureLoaded: () => void
}

// Loader for the merged, readable transcript (cues coalesced into paragraphs
// server-side).
export function useTranscript(videoId: string | null): Captions {
	const [segments, setSegments] = useState<TranscriptSegment[] | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setSegments(null)
		setError(null)
		setLoading(false)
	}, [videoId])

	const ensureLoaded = useCallback(async () => {
		if (!videoId || segments || loading) return
		setLoading(true)
		setError(null)
		const res = await send<{ ok: boolean; segments?: TranscriptSegment[]; error?: string }>({
			type: 'ES_TRANSCRIPT',
			videoId,
		})
		setLoading(false)
		if (res.ok) setSegments(res.segments || [])
		else setError(res.error || 'No captions found for this video.')
	}, [videoId, segments, loading])

	return { segments, loading, error, ensureLoaded }
}

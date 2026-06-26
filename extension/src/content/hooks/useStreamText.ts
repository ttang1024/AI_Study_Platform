import { useCallback, useEffect, useRef, useState } from 'react'
import { connectStream } from '../../lib/messaging'

// ── streaming text (summary / mind map) ─────────────────────────────────────
// `kind` is 'summary' | 'mindmap'; the worker saves the video and streams the
// persisting endpoint so generated text is written to the DB.
// `preset` is already-generated content from the user's library (DB): when
// present it's shown directly, and generation only runs if the user asks.
export function useStreamText(videoId: string | null, kind: 'summary' | 'mindmap', preset?: string) {
	const [text, setText] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const portRef = useRef<chrome.runtime.Port | null>(null)
	const touchedRef = useRef(false) // user kicked off their own generation

	const cancel = useCallback(() => {
		if (portRef.current) {
			try {
				portRef.current.postMessage({ type: 'cancel' })
				portRef.current.disconnect()
			} catch {
				/* already closed */
			}
			portRef.current = null
		}
		setLoading(false)
	}, [])

	// reset + stop any stream when the video changes / on unmount
	useEffect(() => {
		setText('')
		setError(null)
		touchedRef.current = false
		return cancel
	}, [videoId, cancel])

	// Adopt saved content from the library once it loads, unless the user has
	// already started their own (re)generation for this video.
	useEffect(() => {
		if (preset && !touchedRef.current) setText(preset)
	}, [preset])

	const start = useCallback(() => {
		if (!videoId || portRef.current) return
		touchedRef.current = true
		setText('')
		setError(null)
		setLoading(true)
		const port = connectStream()
		portRef.current = port
		port.onMessage.addListener((m: any) => {
			if (m.type === 'chunk') setText((t) => t + m.text)
			else if (m.type === 'done') {
				setLoading(false)
				try {
					port.disconnect()
				} catch {}
				portRef.current = null
			} else if (m.type === 'error') {
				setLoading(false)
				setError(m.error || 'Generation failed.')
				portRef.current = null
			}
		})
		port.onDisconnect.addListener(() => setLoading(false))
		port.postMessage({ type: 'start', kind, videoUrl: `https://www.youtube.com/watch?v=${videoId}` })
	}, [videoId, kind])

	const regenerate = useCallback(() => {
		cancel()
		// allow the port ref to clear before starting again
		setTimeout(start, 0)
	}, [cancel, start])

	return { text, loading, error, start, regenerate }
}

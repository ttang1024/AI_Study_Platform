import { useCallback, useEffect, useState } from 'react'
import { send, type Status } from '../../lib/messaging'

// ── connection status ───────────────────────────────────────────────────────
export function useStatus(active: boolean) {
	const [status, setStatus] = useState<Status | null>(null)
	const refresh = useCallback(async () => {
		setStatus(await send<Status>({ type: 'ES_STATUS' }))
	}, [])
	useEffect(() => {
		if (!active) return
		refresh()
		// The user logs in on the web app in another tab; re-check when they come
		// back here so the panel unlocks without a manual reload. Poll on a slow
		// timer too (the bridge needs a beat to mirror the new token).
		const onFocus = () => refresh()
		window.addEventListener('focus', onFocus)
		document.addEventListener('visibilitychange', onFocus)
		const timer = window.setInterval(refresh, 5000)
		return () => {
			window.removeEventListener('focus', onFocus)
			document.removeEventListener('visibilitychange', onFocus)
			clearInterval(timer)
		}
	}, [active, refresh])
	return { status, refresh }
}

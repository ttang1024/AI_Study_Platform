import { useEffect, useState } from 'react'
import { send } from '../../lib/messaging'

// ── library (already-generated content from the DB) ─────────────────────────
export interface LibraryContent {
	id: string | null
	summary: string
}

const EMPTY_LIBRARY: LibraryContent = { id: null, summary: '' }

// Fetches the user's saved record for this video (when signed in) so each tab
// can render persisted content instead of regenerating it.
export function useLibrary(videoId: string | null, active: boolean) {
	const [lib, setLib] = useState<LibraryContent>(EMPTY_LIBRARY)

	useEffect(() => {
		setLib(EMPTY_LIBRARY)
		if (!videoId || !active) return
		let cancelled = false
		send<any>({ type: 'ES_LIBRARY', videoId }).then((res) => {
			if (cancelled || !res?.ok || !res.found) return
			setLib({
				id: res.id ?? null,
				summary: res.summary || '',
			})
		})
		return () => {
			cancelled = true
		}
	}, [videoId, active])

	return lib
}

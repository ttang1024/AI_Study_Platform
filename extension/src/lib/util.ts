// Small DOM / formatting helpers shared by the panel.

export function fmtTime(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds || 0))
	const h = Math.floor(s / 3600)
	const m = Math.floor((s % 3600) / 60)
	const sec = s % 60
	const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
	return (h > 0 ? `${h}:` : '') + `${mm}:${String(sec).padStart(2, '0')}`
}

export function getVideoId(): string | null {
	try {
		const u = new URL(location.href)
		if (u.pathname === '/watch') return u.searchParams.get('v')
		if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null
	} catch {
		/* ignore */
	}
	return null
}

export function videoEl(): HTMLVideoElement | null {
	return (
		document.querySelector<HTMLVideoElement>('video.html5-main-video') ||
		document.querySelector<HTMLVideoElement>('video')
	)
}

export function seekTo(t: number): void {
	const v = videoEl()
	if (v) {
		v.currentTime = t
		v.play?.().catch(() => {})
	}
}

export function copyText(text: string): void {
	if (!text) return
	navigator.clipboard?.writeText(text).catch(() => {})
}

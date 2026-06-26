// The user's saved video library: locating the saved record for a YouTube
// video, creating one (under a default course) so generated content can be
// persisted, and reading back whatever content was already generated.

import { apiFetch } from './api'

export function extractYouTubeId(url: string): string | null {
	try {
		const u = new URL(url)
		return u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null)
	} catch {
		return null
	}
}

// Find the user's saved record id for this YouTube video, if any.
async function findSavedVideoId(videoId: string): Promise<string | null> {
	const res = await apiFetch('/api/videos/lite?page=1&pageSize=500')
	if (!res.ok) return null
	const body = await res.json().catch(() => null)
	const items: any[] = body?.data?.items || []
	const match = items.find((v) => v.videoId === videoId && (v.sourceType ?? 'youtube') === 'youtube')
	return match?.id ?? null
}

// Pick the user's "Uncategorized" course, creating it if needed, so saved
// videos land somewhere predictable rather than in an arbitrary course.
async function ensureDefaultCourse(): Promise<string | null> {
	const res = await apiFetch('/api/courses')
	if (res.ok) {
		const body = await res.json().catch(() => null)
		const courses: any[] = body?.data || []
		const existing = courses.find((c) => (c.courseName || '').toLowerCase() === 'uncategorized')
		if (existing) return existing.courseId
	}
	const createRes = await apiFetch('/api/courses', {
		method: 'POST',
		body: { courseName: 'Uncategorized', courseColor: '#059669' },
	})
	if (!createRes.ok) return null
	const createBody = await createRes.json().catch(() => null)
	return createBody?.data?.courseId ?? null
}

// Get-or-create the saved library record for this video so generated content
// can be persisted against it. Returns the record id, or null on failure.
export async function ensureVideo(videoId: string, videoUrl: string): Promise<string | null> {
	try {
		const existing = await findSavedVideoId(videoId)
		if (existing) return existing

		const courseId = await ensureDefaultCourse()
		if (!courseId) return null

		let title = ''
		let thumbnailUrl = ''
		const metaRes = await apiFetch(`/api/videos/video-metadata?videoUrl=${encodeURIComponent(videoUrl)}`)
		if (metaRes.ok) {
			const metaBody = await metaRes.json().catch(() => null)
			title = metaBody?.data?.title || ''
			thumbnailUrl = metaBody?.data?.thumbnailUrl || ''
		}

		const saveRes = await apiFetch('/api/videos', {
			method: 'POST',
			body: {
				courseId,
				videoId,
				videoUrl,
				sourceType: 'youtube',
				title: title || 'YouTube Video',
				thumbnailUrl: thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
			},
		})
		if (!saveRes.ok) return null
		const saveBody = await saveRes.json().catch(() => null)
		return saveBody?.data?.id ?? null
	} catch {
		return null
	}
}

// Look up the user's saved record for this YouTube video and return whatever
// content was already generated and persisted (summary) so the panel can render
// it straight from the DB instead of regenerating.
export async function handleLibrary(videoId: string) {
	let id: string | null
	try {
		id = await findSavedVideoId(videoId)
	} catch {
		return { ok: true, found: false } // not signed in → nothing saved to read
	}
	if (!id) return { ok: true, found: false }

	const vRes = await apiFetch(`/api/videos/${id}`)
	const vBody = await vRes.json().catch(() => null)

	return {
		ok: true,
		found: true,
		id,
		summary: vBody?.data?.summary || '',
	}
}

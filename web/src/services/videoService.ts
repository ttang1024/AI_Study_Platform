// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP + SSE adapters into the shared factory and re-exports the types, so
// existing `@/services/videoService` imports across web/ keep working unchanged.
// Web-local: uploadVideo (browser File/Blob) and the sync token-in-query URL
// builders (localStorage + web base URL).
import { createVideoService, type VideoDetail } from '@core/services/videoService'
import { http } from './http'
import { streamSse } from './streamSse'
import { apiClient } from './apiClient'
import { getApiUrl } from '../utils/env'

export * from '@core/services/videoService'

const VIDEO_API = '/api/videos'

const coreService = createVideoService(http, streamSse)

/** Standalone export kept for existing call sites (StudyContext auth reset, mutations). */
export const invalidateVideoListCache = (): void => coreService.invalidateVideoListCache()

export const videoService = {
	...coreService,

	async uploadVideo(courseId: string, file: File, thumbnail?: Blob): Promise<VideoDetail> {
		const formData = new FormData()
		formData.append('courseId', courseId)
		formData.append('file', file)
		if (thumbnail) {
			formData.append('thumbnail', thumbnail, `${file.name.replace(/\.[^.]+$/, '') || 'video'}-cover.jpg`)
		}
		const res = await apiClient.post<{ data: VideoDetail }>(
			`${VIDEO_API}/upload`,
			formData,
			{ headers: { 'Content-Type': 'multipart/form-data' } },
		)
		coreService.invalidateVideoListCache()
		return res.data.data
	},

	getUploadedVideoStreamUrl(videoRecordId: string): string {
		const token = typeof window !== 'undefined' ? localStorage.getItem('sp_access_token') : null
		const baseUrl = getApiUrl()
		const path = `${VIDEO_API}/${videoRecordId}/file`
		return token
			? `${baseUrl}${path}?access_token=${encodeURIComponent(token)}`
			: `${baseUrl}${path}`
	},

	getUploadedVideoThumbnailUrl(videoRecordId: string): string {
		const token = typeof window !== 'undefined' ? localStorage.getItem('sp_access_token') : null
		const baseUrl = getApiUrl()
		const path = `${VIDEO_API}/${videoRecordId}/thumbnail`
		return token
			? `${baseUrl}${path}?access_token=${encodeURIComponent(token)}`
			: `${baseUrl}${path}`
	},
}

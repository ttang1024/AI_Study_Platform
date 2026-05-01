import { Document } from '../types';
import { VideoListItem } from './youtubeService';

export interface PendingMaterial {
	kind: 'document' | 'video';
	id: string;
	courseId: string;
	courseName: string;
	courseColor: string;
	name: string;
	contentType?: string | null;
	blobUrl?: string | null;
	originalUrl?: string | null;
	videoId?: string | null;
	videoUrl?: string | null;
	thumbnailUrl?: string | null;
	createdAt: string;
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac', '.webm'];

const getDocumentType = (contentType = '', fileName = ''): Document['type'] => {
	const lowerName = fileName.toLowerCase();
	if (contentType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
	if (
		contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
		lowerName.endsWith('.docx')
	) return 'docx';
	if (contentType === 'text/markdown' || contentType === 'text/x-markdown' || lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) return 'md';
	if (contentType === 'audio/podcast') return 'podcast';
	if (contentType.startsWith('audio/') || AUDIO_EXTENSIONS.some(ext => lowerName.endsWith(ext))) return 'audio';
	return 'txt';
};

export const pendingMaterialToItem = (material: PendingMaterial) => {
	if (material.kind === 'video') {
		return {
			kind: 'video' as const,
			video: {
				id: material.id,
				courseId: material.courseId,
				courseName: material.courseName,
				courseColor: material.courseColor,
				videoId: material.videoId ?? '',
				videoUrl: material.videoUrl ?? '',
				title: material.name,
				thumbnailUrl: material.thumbnailUrl ?? '',
				summary: null,
				noteContent: null,
				flashcardsJson: null,
				quizJson: null,
				createdAt: material.createdAt,
			} satisfies VideoListItem,
		};
	}

	return {
		kind: 'doc' as const,
		doc: {
			id: material.id,
			name: material.name,
			title: material.name,
			type: getDocumentType(material.contentType ?? '', material.name),
			url: material.blobUrl ?? '',
			uploadDate: material.createdAt,
			courseId: material.courseId,
			originalUrl: material.originalUrl ?? undefined,
		} satisfies Document,
	};
};

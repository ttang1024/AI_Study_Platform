import React from 'react';
import { FileText, FileType, FileCode, Mic } from 'lucide-react';
import { parseYouTubeId } from '@core/videoSources';
import { videoService, VideoListItem } from '../../services/videoService';

export function getVideoThumbSrc(video: VideoListItem) {
  const sourceType = video.sourceType ?? 'youtube';
  if (sourceType === 'bilibili') return video.thumbnailUrl || '/images/bilibili.png';
  if (sourceType === 'upload') return videoService.getUploadedVideoThumbnailUrl(video.id);
  const videoId = parseYouTubeId(video.videoUrl) ?? video.videoId;
  return video.thumbnailUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '');
}

export function getVideoThumbFallback(video: VideoListItem) {
  const sourceType = video.sourceType ?? 'youtube';
  if (sourceType === 'bilibili') return '/images/bilibili.png';
  if (sourceType === 'youtube') {
    const videoId = parseYouTubeId(video.videoUrl) ?? video.videoId;
    return videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
  }
  return '';
}

export const FILE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  pdf: { icon: FileText, label: 'PDF', color: 'text-red-400' },
  docx: { icon: FileText, label: 'DOCX', color: 'text-teal-500' },
  txt: { icon: FileType, label: 'TXT', color: 'text-zinc-400' },
  md: { icon: FileCode, label: 'MD', color: 'text-teal-400' },
  audio: { icon: Mic, label: 'Audio', color: 'text-green-400' },
  podcast: { icon: Mic, label: 'Podcast', color: 'text-purple-400' },
};

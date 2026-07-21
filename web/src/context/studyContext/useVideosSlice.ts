import { useCallback, useRef, useState } from 'react';
import { VideoListItem, videoService } from '../../services/videoService';
import { fetchAllSize } from './helpers';

interface UseVideosSliceArgs {
  isAuthenticated: boolean;
  isLoading: boolean;
  totalVideos: number;
  setTotalVideos: React.Dispatch<React.SetStateAction<number>>;
  setTotalMaterials: React.Dispatch<React.SetStateAction<number>>;
  refreshStats: () => Promise<void>;
}

/** The (lite, label-only) video list — lazy load-once, used to label content sources. */
export function useVideosSlice({
  isAuthenticated, isLoading, totalVideos, setTotalVideos, setTotalMaterials, refreshStats,
}: UseVideosSliceArgs) {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  // Lazy: starts false; flips true only while a fetch is actually in flight.
  const [videosLoading, setVideosLoading] = useState(false);
  const statusRef = useRef<'idle' | 'loading' | 'loaded'>('idle');

  const refreshVideos = useCallback(async (): Promise<void> => {
    if (totalVideos === 0) { setVideos([]); statusRef.current = 'loaded'; return; }
    setVideosLoading(true);
    try {
      const result = await videoService.getVideosLite({ page: 1, pageSize: fetchAllSize(totalVideos) });
      setVideos(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh videos:', error);
    } finally {
      setVideosLoading(false);
    }
  }, [totalVideos]);

  // Lazy load-once — pulled the first time a page that reads it mounts, rather than eagerly on login.
  const ensureVideos = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (statusRef.current !== 'idle') return;
    statusRef.current = 'loading';
    if (totalVideos === 0) { setVideos([]); statusRef.current = 'loaded'; return; }
    setVideosLoading(true);
    try {
      const result = await videoService.getVideosLite({ page: 1, pageSize: fetchAllSize(totalVideos) });
      setVideos(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load videos:', error);
      statusRef.current = 'idle';
    } finally {
      setVideosLoading(false);
    }
  }, [isAuthenticated, isLoading, totalVideos]);

  const deleteVideo = async (videoId: string): Promise<void> => {
    await videoService.deleteVideo(videoId);
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setTotalVideos(prev => Math.max(0, prev - 1));
    setTotalMaterials(prev => Math.max(0, prev - 1));
    refreshStats();
  };

  const markIdle = useCallback(() => { statusRef.current = 'idle'; }, []);

  return { videos, setVideos, videosLoading, setVideosLoading, refreshVideos, ensureVideos, deleteVideo, markIdle };
}

import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { videoService, type VideoDetail } from '@/services/videoService';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { isKnownTab, type SeekHandle, type Tab } from '@/components/library/videoDetailMeta';

/**
 * Loads a video, owns the detail screen's tab state, and holds the seek
 * plumbing for the summary timeline. Upload/YouTube players seek in place via
 * imperative refs; other iframe embeds have no JS seek API, so we reload them at
 * the offset (bump the nonce to force a fresh WebView) — mirrors web.
 */
export function useVideoDetail() {
  const { id, tab: initialTab, t: seekParam } = useLocalSearchParams<{ id: string; tab?: string; t?: string }>();
  const navigation = useNavigation();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>(isKnownTab(initialTab) ? initialTab : 'summary');

  const uploadedRef = useRef<SeekHandle>(null);
  const youtubeRef = useRef<SeekHandle>(null);
  const [embedStartSeconds, setEmbedStartSeconds] = useState(0);
  const [embedSeekNonce, setEmbedSeekNonce] = useState(0);

  const seekTo = useCallback((seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const source = video?.sourceType;
    if (source === 'upload') {
      uploadedRef.current?.seek(safe);
    } else if (source === 'youtube') {
      youtubeRef.current?.seek(safe);
    } else {
      setEmbedStartSeconds(safe);
      setEmbedSeekNonce((n) => n + 1);
    }
  }, [video?.sourceType]);

  // A `t` param means we arrived from a citation's "jump to source". Seek once the video has
  // loaded — before that the player refs are empty and the seek would be dropped — and only once,
  // or it would fight the user's own scrubbing on every re-render.
  const deepLinkSeeked = useRef(false);
  useEffect(() => {
    if (deepLinkSeeked.current || !video || !seekParam) return;

    const seconds = Number(seekParam);
    if (!Number.isFinite(seconds) || seconds < 0) return;

    deepLinkSeeked.current = true;

    // Deferred a frame rather than seeking inline. The player mounts in the same commit that sets
    // `video`, so its imperative ref is not attached yet and an immediate seek would be dropped —
    // and for embed sources seekTo sets state, which must not happen in an effect body.
    const timer = setTimeout(() => seekTo(seconds), 0);
    return () => clearTimeout(timer);
  }, [video, seekParam, seekTo]);

  // Attribute watch/study time on this video to its course in analytics.
  useStudyTimer({ contextType: 'video', courseId: video?.courseId, contextId: id, enabled: !loading && !error });

  useEffect(() => {
    if (!id) return;
    videoService.getVideo(id)
      .then((v) => {
        setVideo(v);
        // Route param changes reuse this screen instance — clear a stale error
        // from a previous video so the successful load actually renders.
        setError(false);
        navigation.setOptions({ title: v.title });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, navigation]);

  return {
    id, video, setVideo, loading, error, tab, setTab,
    seekTo, uploadedRef, youtubeRef, embedStartSeconds, embedSeekNonce,
  };
}


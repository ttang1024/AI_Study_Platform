import { useEffect, useRef, useState } from 'react';
import { videoService, TranscriptSegment } from '../../services/videoService';
import { useSelectionToolbar } from './useSelectionToolbar';
import { fmtTime, fmtSrtTime } from './helpers';
import type { VideoSourceType } from '../../constants/videoSources';

interface UseVideoTranscriptArgs {
  id: string | undefined;
  videoId: string | null;
  videoUrl: string | null;
  sourceType: VideoSourceType;
  videoTitle: string | null;
}

/** Transcript/subtitles fetching, export (copy/download) and the transcript-panel text selection toolbar. */
export function useVideoTranscript({ id, videoId, videoUrl, sourceType, videoTitle }: UseVideoTranscriptArgs) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { toolbar: transcriptToolbar, setToolbar: setTranscriptToolbar, onMouseUp: handleTranscriptMouseUp } = useSelectionToolbar();

  // Center panel view: transcript or subtitles
  const [centerView, setCenterView] = useState<'transcript' | 'subtitles'>('transcript');

  // Transcript
  const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);

  // Subtitles (raw caption lines)
  const [subtitles, setSubtitles] = useState<TranscriptSegment[] | null>(null);
  const [subtitlesError, setSubtitlesError] = useState<string | null>(null);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  const [resolvedSubtitlesVideoId, setResolvedSubtitlesVideoId] = useState<string | null>(null);

  // Transcript copy/download menus
  const [openMenu, setOpenMenu] = useState<'copy' | 'download' | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const fetchTranscript = async (vid: string, fetcher: (v: string) => Promise<TranscriptSegment[]>) => {
    setIsLoadingTranscript(true);
    setTranscriptError(null);
    try {
      const segments = await fetcher(vid);
      setTranscript(segments.length > 0 ? segments : null);
    } catch (err: any) {
      setTranscriptError(err?.response?.data?.message ?? 'No captions available for this video.');
      setTranscript(null);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const fetchSubtitles = async (vid: string, fetcher: (v: string) => Promise<TranscriptSegment[]>) => {
    setIsLoadingSubtitles(true);
    setSubtitlesError(null);
    setResolvedSubtitlesVideoId(null);
    try {
      const segments = await fetcher(vid);
      setSubtitles(segments.length > 0 ? segments : null);
    } catch (err: any) {
      setSubtitlesError(err?.response?.data?.message ?? 'No captions available for this video.');
      setSubtitles(null);
    } finally {
      setResolvedSubtitlesVideoId(vid);
      setIsLoadingSubtitles(false);
    }
  };

  // Fetch transcript when video loads. Subtitles and transcript are independent endpoints —
  // fire them together instead of chaining, since neither result depends on the other.
  useEffect(() => {
    if (!videoId || !videoUrl || !id) return;
    setResolvedSubtitlesVideoId(null);
    setSubtitles(null);
    setSubtitlesError(null);
    if (sourceType === 'youtube') {
      fetchSubtitles(videoId, videoService.getSubtitles);
      fetchTranscript(videoId, videoService.getTranscript);
    } else {
      fetchSubtitles(id, videoService.getVideoSubtitles);
      fetchTranscript(id, videoService.getVideoTranscript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, sourceType, id]);

  const refreshTranscript = () => {
    if (sourceType === 'youtube' && videoId) {
      void fetchTranscript(videoId, videoService.getTranscript);
      return;
    }
    if (id) void fetchTranscript(id, videoService.getVideoTranscript);
  };

  const refreshSubtitles = () => {
    if (sourceType === 'youtube' && videoId) {
      void fetchSubtitles(videoId, videoService.getSubtitles);
      return;
    }
    if (id) void fetchSubtitles(id, videoService.getVideoSubtitles);
  };

  const loadSubtitlesOnDemand = () => {
    if (subtitles || subtitlesError || isLoadingSubtitles || !videoId) return;
    if (sourceType === 'youtube') fetchSubtitles(videoId, videoService.getSubtitles);
    else if (id) fetchSubtitles(id, videoService.getVideoSubtitles);
  };

  // Click-outside to close transcript menus
  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (copyMenuRef.current?.contains(target) || downloadMenuRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  // ─── Transcript export ───────────────────────────────────────────────────────

  const getTranscriptText = (withTimestamp: boolean) => {
    if (!transcript) return '';
    return withTimestamp
      ? transcript.map(seg => `[${fmtTime(seg.startSeconds)}] ${seg.text}`).join('\n')
      : transcript.map(seg => seg.text).join(' ');
  };

  const getTranscriptSrt = (withTimestamp: boolean) => {
    if (!transcript) return '';
    return transcript.map((seg, i) => {
      const start = seg.startSeconds;
      const end = transcript[i + 1]?.startSeconds ?? start + 5;
      return withTimestamp
        ? `${i + 1}\n${fmtSrtTime(start)} --> ${fmtSrtTime(end)}\n${seg.text}`
        : `${i + 1}\n${seg.text}`;
    }).join('\n\n');
  };

  const copyTranscript = (withTimestamp: boolean) => {
    navigator.clipboard.writeText(getTranscriptText(withTimestamp));
    setOpenMenu(null);
  };

  const downloadTranscript = (format: 'txt' | 'srt', withTimestamp: boolean) => {
    const content = format === 'srt' ? getTranscriptSrt(withTimestamp) : getTranscriptText(withTimestamp);
    const suffix = withTimestamp ? '_timestamps' : '';
    const base = (videoTitle ?? videoId ?? 'transcript').replace(/[^a-z0-9_\-]/gi, '_');
    const filename = `${base}${suffix}.${format}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setOpenMenu(null);
  };

  return {
    transcriptRef, transcriptToolbar, setTranscriptToolbar, handleTranscriptMouseUp,
    centerView, setCenterView, loadSubtitlesOnDemand,
    transcript, transcriptError, isLoadingTranscript, refreshTranscript,
    subtitles, subtitlesError, isLoadingSubtitles, refreshSubtitles, resolvedSubtitlesVideoId,
    openMenu, setOpenMenu, copyMenuRef, downloadMenuRef, copyTranscript, downloadTranscript,
  };
}

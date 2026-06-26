import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, Link, Loader2, ListVideo, Zap, ArrowRight, Brain, Captions, PlayCircle, Award } from 'lucide-react';
import { Button } from '../common/Button';
import { VideoCard } from '../common/VideoCard';
import { usePrompt } from '../common/PromptBox';
import { useStudy } from '../../context/StudyContext';
import { videoService, VideoListItem } from '../../services/videoService';
import { cn } from '../../utils/cn';
import { PlaylistImportModal } from './PlaylistImportModal';
import { DuplicateAlert } from './DuplicateAlert';

const container = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const YT_FEATURES = [
  { icon: Brain, label: 'AI Summary', color: 'text-red-400 bg-red-50' },
  { icon: Captions, label: 'Transcript', color: 'text-teal-500 bg-teal-50' },
  { icon: PlayCircle, label: 'Flashcards', color: 'text-teal-400 bg-teal-50' },
  { icon: Award, label: 'Quizzes', color: 'text-zinc-400 bg-zinc-50' },
];

function parseVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseBilibiliVideo(url: string): { bvid: string; page: number; key: string } | null {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);
    if (!m) return null;
    const page = Math.max(1, Number.parseInt(u.searchParams.get('p') ?? '1', 10) || 1);
    return { bvid: m[1], page, key: page > 1 ? `${m[1]}:p${page}` : m[1] };
  } catch {
    const m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+).*?[?&]p=(\d+)/i)
      ?? url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
    if (!m) return null;
    const page = Math.max(1, Number.parseInt(m[2] ?? '1', 10) || 1);
    return { bvid: m[1], page, key: page > 1 ? `${m[1]}:p${page}` : m[1] };
  }
}

function parsePlaylistId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.searchParams.get('list');
  } catch {
    return null;
  }
}

export interface YouTubeTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
  source?: 'youtube' | 'bilibili';
}

export const YouTubeTab: React.FC<YouTubeTabProps> = ({ selectedCourseId, onCourseError, source = 'youtube' }) => {
  const navigate = useNavigate();
  const { refreshStats } = useStudy();
  const { showPrompt } = usePrompt();
  const [urlInput, setUrlInput] = useState(() => {
    // Allow deep-linking a video to analyze, e.g. from the browser extension:
    //   /summarizer?tab=youtube&url=<encoded youtube url>
    if (typeof window === 'undefined') return '';
    const u = new URLSearchParams(window.location.search).get('url');
    return u ?? '';
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [allVideos, setAllVideos] = useState<VideoListItem[]>([]);
  const [playlistModal, setPlaylistModal] = useState<{ source: 'youtube'; playlistId: string } | { source: 'bilibili'; videoUrl: string } | null>(null);

  const loadAllVideos = useCallback(() => {
    videoService.getVideos({ page: 1, pageSize: 10 })
      .then(data => setAllVideos(data.items))
      .catch(() => { });
  }, []);

  useEffect(() => { loadAllVideos(); }, [loadAllVideos]);

  const isBilibili = source === 'bilibili';
  const detectedBilibiliVideo = isBilibili ? parseBilibiliVideo(urlInput.trim()) : null;
  const detectedVideoId = isBilibili ? detectedBilibiliVideo?.key ?? null : parseVideoId(urlInput.trim());
  const dupVideo = detectedVideoId ? (allVideos.find(v => v.videoId === detectedVideoId && (v.sourceType ?? 'youtube') === source) ?? null) : null;

  const selectedCourseIdRef = useRef('');
  useEffect(() => { selectedCourseIdRef.current = selectedCourseId; }, [selectedCourseId]);

  const isPlaylistUrl = (url: string) => !isBilibili && !!parsePlaylistId(url);

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!selectedCourseIdRef.current) { onCourseError(true); return; }
    onCourseError(false);

    const listId = isBilibili ? null : parsePlaylistId(trimmed);
    if (listId) {
      setPlaylistModal({ source: 'youtube', playlistId: listId });
      return;
    }

    const bilibiliVideo = isBilibili ? parseBilibiliVideo(trimmed) : null;
    const ytVid = isBilibili ? bilibiliVideo?.key ?? null : parseVideoId(trimmed);
    if (!ytVid) { showPrompt(isBilibili ? 'Invalid Bilibili URL. Please enter a valid Bilibili video link.' : 'Invalid YouTube URL. Please enter a valid YouTube video or playlist link.'); return; }

    setIsAnalyzing(true);
    try {
      let title = 'Untitled Video';
      let thumbnailUrl = isBilibili ? '/images/bilibili.png' : `https://img.youtube.com/vi/${ytVid}/mqdefault.jpg`;
      try {
        if (isBilibili) {
          const items = await videoService.getBilibiliItems(trimmed);
          if (items.length > 1 && bilibiliVideo!.page === 1) {
            setPlaylistModal({ source: 'bilibili', videoUrl: trimmed });
            return;
          }
          const selectedItem = items.find(item => item.videoId === ytVid) ?? items[0];
          if (selectedItem) {
            title = selectedItem.title || title;
            thumbnailUrl = selectedItem.thumbnailUrl || thumbnailUrl;
          } else {
            const meta = await videoService.getVideoMetadata(trimmed);
            if (meta) {
              if (meta.title) title = meta.title;
              if (meta.thumbnailUrl) thumbnailUrl = meta.thumbnailUrl;
            } else {
              title = `Bilibili ${bilibiliVideo!.bvid}${bilibiliVideo!.page > 1 ? ` P${bilibiliVideo!.page}` : ''}`;
            }
          }
        } else {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`);
          const oembed = await oembedRes.json();
          title = oembed.title ?? title;
        }
      } catch { }
      const saved = await videoService.createVideo({
        courseId: selectedCourseIdRef.current,
        videoId: ytVid,
        videoUrl: trimmed,
        sourceType: source,
        title,
        thumbnailUrl,
        summary: null,
      });
      refreshStats();
      const returnTo = `/summarizer?tab=video&courseId=${encodeURIComponent(selectedCourseIdRef.current)}`;
      navigate(`/videos/${saved.id}`, { state: { returnTo } });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to add video. Please try again.';
      showPrompt(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlaylistComplete = () => {
    setPlaylistModal(null);
    setUrlInput('');
    refreshStats();
    loadAllVideos();
  };

  const detectedPlaylist = !!urlInput.trim() && isPlaylistUrl(urlInput);

  return (
    <>
      <AnimatePresence>
        {playlistModal && (
          <PlaylistImportModal
            key="playlist-modal"
            playlistId={playlistModal.source === 'youtube' ? playlistModal.playlistId : undefined}
            videoUrl={playlistModal.source === 'bilibili' ? playlistModal.videoUrl : undefined}
            courseId={selectedCourseIdRef.current}
            existingVideos={allVideos}
            source={playlistModal.source}
            onClose={() => setPlaylistModal(null)}
            onComplete={handlePlaylistComplete}
          />
        )}
      </AnimatePresence>

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={item}>
          <form
            onSubmit={handleAnalyze}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-500 overflow-hidden h-60 gap-5',
              isFocused || urlInput
                ? detectedPlaylist ? 'border-orange-400 bg-orange-50/30' : 'border-red-400 bg-red-50/30'
                : 'border-zinc-200 bg-white hover:border-red-300/60 hover:bg-red-50/10',
            )}
          >
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative z-10 flex flex-col items-center gap-3 text-center pointer-events-none">
              <div className="relative">
                <div className={cn('absolute inset-0 blur-xl rounded-2xl transition-opacity duration-500', isFocused ? (detectedPlaylist ? 'opacity-25 bg-orange-500' : isBilibili ? 'opacity-25 bg-sky-500' : 'opacity-25 bg-red-500') : 'opacity-0 bg-red-500')} />
                <div className={cn('relative rounded-2xl p-4 text-white shadow-lg transition-all duration-500', isFocused ? 'scale-105 -rotate-2' : '', detectedPlaylist ? 'bg-orange-500' : isBilibili ? 'bg-sky-500' : 'bg-red-500')}>
                  {detectedPlaylist ? (
                    <ListVideo size={28} />
                  ) : isBilibili ? (
                    <img src="/images/bilibili-white.png" alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <Youtube size={28} />
                  )}
                </div>
              </div>
              <div>
                {detectedPlaylist
                  ? <p className="text-lg font-black tracking-tight text-zinc-900">{isBilibili ? 'Bilibili list detected — import all videos' : 'Playlist detected — import all videos'}</p>
                  : <p className="text-lg font-black tracking-tight text-zinc-900">Paste a {isBilibili ? 'Bilibili' : 'YouTube'} link</p>}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {YT_FEATURES.map(({ icon: Icon, label, color }) => (
                  <div key={label} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold', color)}>
                    <Icon size={11} />{label}
                  </div>
                ))}
                <span className="text-[11px] text-zinc-400 font-medium">· and more</span>
              </div>
            </div>
            <div className="relative z-10 w-full px-6 pointer-events-auto">
              <div className={cn(
                'flex items-center gap-2 rounded-xl border bg-white/80 backdrop-blur-sm px-4 py-3 transition-all duration-300 shadow-sm',
                isFocused
                  ? detectedPlaylist
                    ? 'border-orange-400 shadow-orange-100 shadow-md ring-2 ring-orange-400/20'
                    : 'border-red-400 shadow-red-100 shadow-md ring-2 ring-red-400/20'
                  : 'border-zinc-200',
              )}>
                <Link size={16} className={cn('shrink-0 transition-colors', isFocused ? (detectedPlaylist ? 'text-orange-400' : 'text-red-400') : 'text-zinc-400')} />
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={isBilibili ? 'https://www.bilibili.com/video/BV1jMy3YVEh4' : 'https://www.youtube.com/watch?v=… or playlist URL'}
                  className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 min-w-0"
                />
              </div>
            </div>
          </form>
        </motion.div>

        <AnimatePresence>
          {dupVideo && !detectedPlaylist && (
            <DuplicateAlert
              label="video"
              courseName={dupVideo.courseName}
              to={`/videos/${dupVideo.id}`}
            />
          )}
        </AnimatePresence>

        <motion.div variants={item}>
          <Button
            disabled={!urlInput.trim() || isAnalyzing}
            onClick={handleAnalyze}
            className={cn(
              'h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300',
              urlInput.trim() && selectedCourseId && !isAnalyzing
                ? detectedPlaylist
                  ? 'bg-orange-500 text-white shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-95'
                  : 'bg-red-500 text-white shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-95'
                : 'bg-zinc-100 text-zinc-400',
            )}
          >
            {isAnalyzing
              ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Saving…</span>
              : detectedPlaylist
                ? <span className="flex items-center gap-2"><ListVideo size={18} /> {isBilibili ? 'Browse Videos' : 'Browse Playlist'}</span>
                : <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Analyze Video</span>}
          </Button>
        </motion.div>

        {allVideos.length > 0 && (
          <motion.div variants={item} className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main">Recent Videos</h3>
              <RouterLink to="/library?type=videos" className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
                View All <ArrowRight size={12} />
              </RouterLink>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allVideos.filter(video => (video.sourceType ?? 'youtube') === source).slice(0, 3).map(video => (
                <VideoCard
                  key={video.id}
                  video={video}
                  to={`/videos/${video.id}`}
                  compact
                  onDeleted={() => setAllVideos(prev => prev.filter(v => v.id !== video.id))}
                  onMoved={(newCourseId) => setAllVideos(prev => prev.map(v => v.id === video.id ? { ...v, courseId: newCourseId } : v))}
                  onUpdated={(updated) => setAllVideos(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v))}
                />
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </>
  );
};

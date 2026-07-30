import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, Clapperboard, Link, Loader2, ListVideo, Zap, ArrowRight, Brain, Captions, PlayCircle, Award, Wand2, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { VideoCard } from '../common/VideoCard';
import { usePrompt } from '../common/PromptBox';
import { useStudy } from '../../context/StudyContext';
import { videoService, VideoListItem } from '../../services/videoService';
import { cn } from '../../utils/cn';
import { PlaylistImportModal } from './PlaylistImportModal';
import { DuplicateAlert } from './DuplicateAlert';
import {
  detectVideoSource, parseUrlVideoId, isExternalVideoSource,
  URL_SOURCE_BRANDING, type ExternalSourceBranding,
} from '../../constants/videoSources';

const container = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const FEATURES = [
  { icon: Brain, label: 'AI Summary', color: 'text-red-400 bg-red-50' },
  { icon: Captions, label: 'Transcript', color: 'text-teal-500 bg-teal-50' },
  { icon: PlayCircle, label: 'Flashcards', color: 'text-teal-400 bg-teal-50' },
  { icon: Award, label: 'Quizzes', color: 'text-zinc-400 bg-zinc-50' },
];

// Styling shown before a link is recognized.
const NEUTRAL_BRANDING: ExternalSourceBranding = {
  label: 'Video',
  placeholder: 'Paste a link — YouTube, Bilibili, Vimeo, TED, Dailymotion, TikTok, Facebook, Instagram, X, Reddit, LinkedIn',
  badgeBg: 'bg-violet-500',
  text: 'text-violet-500',
  border: 'border-violet-400',
  ring: 'ring-violet-400/20',
  glow: 'bg-violet-500',
  buttonBg: 'bg-violet-500 text-white shadow-violet-500/20 hover:shadow-violet-500/40',
  hoverBorder: 'hover:border-violet-300/60',
  hoverBg: 'hover:bg-violet-50/10',
  focusBg: 'bg-violet-50/30',
  shadow: 'shadow-violet-100',
};

// Styling when a YouTube playlist URL is recognized.
const PLAYLIST_BRANDING: ExternalSourceBranding = {
  ...NEUTRAL_BRANDING,
  label: 'Playlist',
  badgeBg: 'bg-orange-500',
  text: 'text-orange-400',
  border: 'border-orange-400',
  ring: 'ring-orange-400/20',
  glow: 'bg-orange-500',
  buttonBg: 'bg-orange-500 text-white shadow-orange-500/20 hover:shadow-orange-500/40',
  focusBg: 'bg-orange-50/30',
  shadow: 'shadow-orange-100',
};

function parsePlaylistId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('list');
  } catch {
    return url.match(/[?&]list=([^&]+)/)?.[1] ?? null;
  }
}

function parseBilibiliPage(url: string): number {
  return Math.max(1, Number.parseInt(url.match(/[?&]p=(\d+)/)?.[1] ?? '1', 10) || 1);
}

export interface WebVideoTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

/**
 * Auto-detecting URL tab: recognizes the video site from the pasted link
 * (YouTube, Bilibili, Vimeo, TED, Dailymotion, Facebook, Instagram, X, Reddit, LinkedIn)
 * and saves it with the right sourceType. YouTube playlists and Bilibili
 * multi-part videos open the bulk import modal.
 */
export const WebVideoTab: React.FC<WebVideoTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { refreshStats } = useStudy();
  const { showPrompt } = usePrompt();
  const [urlInput, setUrlInput] = useState(() => {
    // Allow deep-linking a video to analyze, e.g. from the browser extension:
    //   /library/add?tab=link&url=<encoded video url>
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('url') ?? '';
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [allVideos, setAllVideos] = useState<VideoListItem[]>([]);
  const [playlistModal, setPlaylistModal] = useState<{ source: 'youtube'; playlistId: string } | { source: 'bilibili'; videoUrl: string } | null>(null);

  // The lite list so duplicate detection (and the playlist modal's "already imported" marks) see
  // the whole library, not just the newest page. VideoCard reads none of the fields it drops.
  const loadAllVideos = useCallback(() => {
    videoService.getVideosLite({ pageSize: 500 })
      .then(data => setAllVideos(data.items))
      .catch(() => { });
  }, []);

  useEffect(() => { loadAllVideos(); }, [loadAllVideos]);

  const trimmed = urlInput.trim();
  const detectedSource = trimmed ? detectVideoSource(trimmed) : null;
  const detectedPlaylist = detectedSource === 'youtube' && !!parsePlaylistId(trimmed);
  const detectedVideoId = detectedSource ? parseUrlVideoId(detectedSource, trimmed) : null;
  const brand = detectedPlaylist ? PLAYLIST_BRANDING : detectedSource ? URL_SOURCE_BRANDING[detectedSource] : NEUTRAL_BRANDING;
  const dupVideo = detectedSource && detectedVideoId && !detectedPlaylist
    ? (allVideos.find(v => v.videoId === detectedVideoId && (v.sourceType ?? 'youtube') === detectedSource) ?? null)
    : null;

  const selectedCourseIdRef = useRef('');
  useEffect(() => { selectedCourseIdRef.current = selectedCourseId; }, [selectedCourseId]);

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    // Already in the library — the DuplicateAlert offers the "View" path instead.
    if (dupVideo) return;
    if (!selectedCourseIdRef.current) { onCourseError(true); return; }
    onCourseError(false);

    const source = detectVideoSource(url);
    if (!source) {
      showPrompt('Unrecognized video link. Supported sites: YouTube, Bilibili, Vimeo, TED, Dailymotion, TikTok, Facebook, Instagram, X (Twitter), Reddit, LinkedIn.');
      return;
    }

    if (source === 'youtube') {
      const listId = parsePlaylistId(url);
      if (listId) {
        setPlaylistModal({ source: 'youtube', playlistId: listId });
        return;
      }
    }

    const videoId = parseUrlVideoId(source, url);
    if (!videoId) {
      showPrompt(`This looks like a ${URL_SOURCE_BRANDING[source].label} link, but no video could be identified in it.`);
      return;
    }

    setIsAnalyzing(true);
    try {
      let title = `${URL_SOURCE_BRANDING[source].label} ${videoId}`;
      let thumbnailUrl = source === 'youtube'
        ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        : source === 'bilibili' ? '/images/bilibili.png' : '';
      try {
        if (source === 'youtube') {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
          const oembed = await oembedRes.json();
          title = oembed.title ?? title;
        } else if (source === 'bilibili') {
          const items = await videoService.getBilibiliItems(url);
          if (items.length > 1 && parseBilibiliPage(url) === 1) {
            setPlaylistModal({ source: 'bilibili', videoUrl: url });
            return;
          }
          const selectedItem = items.find(i => i.videoId === videoId) ?? items[0];
          if (selectedItem) {
            title = selectedItem.title || title;
            thumbnailUrl = selectedItem.thumbnailUrl || thumbnailUrl;
          } else {
            const meta = await videoService.getVideoMetadata(url);
            if (meta?.title) title = meta.title;
            if (meta?.thumbnailUrl) thumbnailUrl = meta.thumbnailUrl;
          }
        } else {
          const meta = await videoService.getVideoMetadata(url);
          if (meta?.title) title = meta.title;
          if (meta?.thumbnailUrl) thumbnailUrl = meta.thumbnailUrl;
        }
      } catch { }
      const saved = await videoService.createVideo({
        courseId: selectedCourseIdRef.current,
        videoId,
        videoUrl: url,
        sourceType: source,
        title,
        thumbnailUrl,
        summary: null,
      });
      refreshStats();
      const returnTo = `/library/add?tab=link&courseId=${encodeURIComponent(selectedCourseIdRef.current)}`;
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

  const BadgeIcon = detectedPlaylist ? ListVideo
    : detectedSource === 'youtube' ? Youtube
    : detectedSource && isExternalVideoSource(detectedSource) ? Clapperboard
    : Wand2;

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
                ? cn(brand.border, brand.focusBg)
                : cn('border-zinc-200 bg-white', NEUTRAL_BRANDING.hoverBorder, NEUTRAL_BRANDING.hoverBg),
            )}
          >
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative z-10 flex flex-col items-center gap-3 text-center pointer-events-none">
              <div className="relative">
                <div className={cn('absolute inset-0 blur-xl rounded-2xl transition-opacity duration-500', brand.glow, isFocused ? 'opacity-25' : 'opacity-0')} />
                <div className={cn('relative rounded-2xl p-4 text-white shadow-lg transition-all duration-500', isFocused ? 'scale-105 -rotate-2' : '', brand.badgeBg)}>
                  {detectedSource === 'bilibili' ? (
                    <img src="/images/bilibili-white.png" alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <BadgeIcon size={28} />
                  )}
                </div>
              </div>
              <div>
                {detectedPlaylist
                  ? <p className="text-lg font-black tracking-tight text-zinc-900">Playlist detected — import all videos</p>
                  : detectedSource
                    ? <p className="text-lg font-black tracking-tight text-zinc-900">{brand.label} link detected</p>
                    : <p className="text-lg font-black tracking-tight text-zinc-900">Paste any video link</p>}
                {!detectedSource && (
                  <p className="mt-1 text-[11px] font-medium text-zinc-400">
                    YouTube · Bilibili · Vimeo · TED · Dailymotion · TikTok · Facebook · Instagram · X · Reddit · LinkedIn
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {FEATURES.map(({ icon: Icon, label, color }) => (
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
                isFocused ? cn(brand.border, brand.shadow, 'shadow-md ring-2', brand.ring) : 'border-zinc-200',
              )}>
                <Link size={16} className={cn('shrink-0 transition-colors', isFocused ? brand.text : 'text-zinc-400')} />
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={NEUTRAL_BRANDING.placeholder}
                  className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 min-w-0"
                />
              </div>
            </div>
          </form>
        </motion.div>

        <AnimatePresence>
          {dupVideo && (
            <DuplicateAlert
              label="video"
              courseName={dupVideo.courseName}
              to={`/videos/${dupVideo.id}`}
            />
          )}
        </AnimatePresence>

        <motion.div variants={item}>
          <Button
            disabled={!urlInput.trim() || isAnalyzing || !!dupVideo}
            onClick={handleAnalyze}
            className={cn(
              'h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300',
              urlInput.trim() && selectedCourseId && !isAnalyzing && !dupVideo
                ? cn(brand.buttonBg, 'hover:scale-[1.02] active:scale-95')
                : 'bg-zinc-100 text-zinc-400',
            )}
          >
            {isAnalyzing
              ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Saving…</span>
              : dupVideo
                ? <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Already in Library</span>
                : detectedPlaylist
                  ? <span className="flex items-center gap-2"><ListVideo size={18} /> Browse Playlist</span>
                  : <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Analyze {detectedSource ? `${brand.label} Video` : 'Video'}</span>}
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
              {allVideos.filter(video => (video.sourceType ?? 'youtube') !== 'upload').slice(0, 3).map(video => (
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

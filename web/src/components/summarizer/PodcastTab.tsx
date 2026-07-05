import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Rss, Link, Loader2, Zap, Brain, Captions, PlayCircle, Award, X, Plus, Check, Search, ListMusic, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { DocumentCard } from '../common/DocumentCard';
import { useStudy } from '../../context/StudyContext';
import { podcastService, PodcastFeed, PodcastFeedEpisode } from '../../services/podcastService';
import { detectPodcastSource, isDirectAudioUrl, looksLikeRssFeedUrl, validatePodcastUrl, PODCAST_SOURCES } from '../../constants/podcastSources';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';
import { cn } from '../../utils/cn';
import { DuplicateAlert } from './DuplicateAlert';

const container = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const PODCAST_FEATURES = [
  { icon: Brain, label: 'AI Summary', color: 'text-teal-500 bg-teal-50' },
  { icon: Captions, label: 'Transcript', color: 'text-teal-400 bg-teal-50' },
  { icon: PlayCircle, label: 'Flashcards', color: 'text-pink-400 bg-pink-50' },
  { icon: Award, label: 'Quizzes', color: 'text-zinc-400 bg-zinc-50' },
];

function formatEpisodeMeta(ep: PodcastFeedEpisode): string {
  const parts: string[] = [];
  if (ep.publishedAt) {
    parts.push(new Date(ep.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
  }
  if (ep.durationMs > 0) {
    const mins = Math.round(ep.durationMs / 60000);
    parts.push(mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : `${mins} min`);
  }
  return parts.join(' · ');
}

export interface PodcastTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export const PodcastTab: React.FC<PodcastTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { documents, courses, ensureDocuments } = useStudy();
  // documents is loaded lazily by StudyContext; pull it for duplicate detection.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);
  const [urlInput, setUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState('');

  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [feedUrl, setFeedUrl] = useState('');
  const [episodeFilter, setEpisodeFilter] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  const isFeedInput = looksLikeRssFeedUrl(urlInput);
  const detectedSource = isFeedInput
    ? 'RSS feed'
    : detectPodcastSource(urlInput)?.label ?? (isDirectAudioUrl(urlInput) ? 'Audio file' : null);

  const podcastDocs = documents.filter(d => d.type === 'podcast');
  const recentPodcasts = podcastDocs.slice(0, 3);
  const getCourse = (id?: string) => courses.find(c => c.id === id);
  const dupPodcast = urlInput.trim()
    ? podcastDocs.find(d => d.originalUrl === urlInput.trim()) ?? null
    : null;
  const dupPodcastCourse = dupPodcast?.courseId ? courses.find(c => c.id === dupPodcast.courseId) : undefined;
  /** Feed episodes already in the library, keyed by episode page link / audio URL. */
  const importedDocByUrl = new Map(podcastDocs.filter(d => d.originalUrl).map(d => [d.originalUrl!, d.id]));
  const importedDocId = (ep: PodcastFeedEpisode) =>
    importedDocByUrl.get(ep.link) ?? importedDocByUrl.get(ep.audioUrl);

  const selectedCourseIdRef = useRef('');
  useEffect(() => { selectedCourseIdRef.current = selectedCourseId; }, [selectedCourseId]);

  const loadFeed = async (url: string) => {
    setError('');
    setIsAnalyzing(true);
    try {
      const result = await podcastService.getFeed(url);
      setFeed(result);
      setFeedUrl(url);
      setEpisodeFilter('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not read a podcast feed at that link.'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const validationError = validatePodcastUrl(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (looksLikeRssFeedUrl(trimmed)) {
      await loadFeed(trimmed);
      return;
    }
    if (!selectedCourseIdRef.current) { onCourseError(true); return; }
    onCourseError(false);
    setError('');
    setIsAnalyzing(true);
    try {
      const episode = await podcastService.create(trimmed, selectedCourseIdRef.current);
      navigate(`/audio/${episode.documentId}`, { state: { courseId: episode.courseId } });
    } catch (err: any) {
      setIsAnalyzing(false);
      // The backend recognized the URL as an RSS feed — switch to the episode picker.
      if (getApiErrorCode(err) === 'RSS_FEED_URL') {
        await loadFeed(trimmed);
        return;
      }
      setError(getApiErrorMessage(err, 'Failed to fetch podcast episode. Please check the URL and try again.'));
      return;
    }
    setIsAnalyzing(false);
  };

  const handleImportEpisode = async (ep: PodcastFeedEpisode) => {
    if (!selectedCourseIdRef.current) { onCourseError(true); return; }
    onCourseError(false);
    setError('');
    setImportingId(ep.id);
    try {
      const episode = await podcastService.createFromFeed(feedUrl, ep.id, selectedCourseIdRef.current);
      navigate(`/audio/${episode.documentId}`, { state: { courseId: episode.courseId } });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to import this episode. Please try again.'));
      setImportingId(null);
    }
  };

  const filteredEpisodes = feed
    ? feed.episodes.filter(ep => ep.title.toLowerCase().includes(episodeFilter.trim().toLowerCase()))
    : [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={item}>
        <form
          onSubmit={handleAnalyze}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-500 overflow-hidden h-60 gap-5',
            isFocused || urlInput
              ? 'border-teal-400 bg-teal-50/30'
              : 'border-zinc-200 bg-white hover:border-teal-300/60 hover:bg-teal-50/10',
          )}
        >
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative z-10 flex flex-col items-center gap-3 text-center pointer-events-none">
            <div className="relative">
              <div className={cn('absolute inset-0 blur-xl rounded-2xl transition-opacity duration-500', isFocused ? 'opacity-25 bg-teal-500' : 'opacity-0 bg-teal-500')} />
              <div className={cn('relative rounded-2xl p-4 text-white shadow-lg transition-all duration-500', isFocused ? 'bg-teal-500 scale-105 -rotate-2' : 'bg-teal-500')}>
                <Rss size={28} />
              </div>
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-zinc-900">Turn any podcast into study material</p>
              <p className="mt-0.5 text-zinc-400 text-xs">
                Episode link ({PODCAST_SOURCES.slice(0, 4).map(s => s.label).join(', ')}, …), RSS feed, or direct MP3
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {PODCAST_FEATURES.map(({ icon: Icon, label, color }) => (
                <div key={label} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold', color)}>
                  <Icon size={11} />{label}
                </div>
              ))}
            </div>
          </div>
          <div className="relative z-10 w-full px-6 pointer-events-auto">
            <div className={cn(
              'flex items-center gap-2 rounded-xl border bg-white/80 backdrop-blur-sm px-4 py-3 transition-all duration-300 shadow-sm',
              isFocused ? 'border-teal-400 shadow-teal-100 shadow-md ring-2 ring-teal-400/20' : 'border-zinc-200',
            )}>
              <Link size={16} className={cn('shrink-0 transition-colors', isFocused ? 'text-teal-400' : 'text-zinc-400')} />
              <input
                type="url"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setError(''); }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Episode page, RSS feed, or MP3 link — e.g. https://podcasts.apple.com/…?i=…"
                className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 min-w-0"
              />
              {detectedSource && (
                <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-600">
                  {detectedSource}
                </span>
              )}
            </div>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {dupPodcast && dupPodcastCourse && (
          <DuplicateAlert
            label="podcast episode"
            courseName={dupPodcastCourse.name}
            to={`/audio/${dupPodcast.id}`}
          />
        )}
      </AnimatePresence>

      {error && (
        <motion.p variants={item} className="text-sm text-red-500">{error}</motion.p>
      )}

      <AnimatePresence>
        {feed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-teal-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
                {feed.thumbnailUrl
                  ? <img src={feed.thumbnailUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-500"><ListMusic size={20} /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-zinc-900">{feed.title || 'Podcast feed'}</p>
                  <p className="text-xs text-zinc-400">{feed.episodes.length} episodes — pick one to analyze</p>
                </div>
                <button
                  onClick={() => { setFeed(null); setFeedUrl(''); }}
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                  aria-label="Close episode list"
                >
                  <X size={16} />
                </button>
              </div>

              {feed.episodes.length > 8 && (
                <div className="border-b border-zinc-100 px-4 py-2.5">
                  <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
                    <Search size={14} className="shrink-0 text-zinc-400" />
                    <input
                      value={episodeFilter}
                      onChange={e => setEpisodeFilter(e.target.value)}
                      placeholder="Filter episodes…"
                      className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 min-w-0"
                    />
                  </div>
                </div>
              )}

              <ul className="max-h-80 divide-y divide-zinc-50 overflow-y-auto">
                {filteredEpisodes.map(ep => {
                  const docId = importedDocId(ep);
                  const meta = formatEpisodeMeta(ep);
                  return (
                    <li key={ep.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-zinc-800">{ep.title}</p>
                        {meta && <p className="mt-0.5 text-xs text-zinc-400">{meta}</p>}
                      </div>
                      {docId ? (
                        <RouterLink
                          to={`/audio/${docId}`}
                          className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100"
                        >
                          <Check size={13} /> Added
                        </RouterLink>
                      ) : (
                        <button
                          onClick={() => handleImportEpisode(ep)}
                          disabled={importingId !== null}
                          className={cn(
                            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                            importingId === ep.id
                              ? 'bg-teal-500 text-white'
                              : importingId !== null
                                ? 'bg-zinc-100 text-zinc-400'
                                : 'bg-teal-50 text-teal-600 hover:bg-teal-500 hover:text-white active:scale-95',
                          )}
                        >
                          {importingId === ep.id
                            ? <><Loader2 size={13} className="animate-spin" /> Adding…</>
                            : <><Plus size={13} /> Analyze</>}
                        </button>
                      )}
                    </li>
                  );
                })}
                {filteredEpisodes.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-zinc-400">No episodes match your filter.</li>
                )}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item}>
        <Button
          disabled={!urlInput.trim() || isAnalyzing || importingId !== null}
          onClick={handleAnalyze}
          className={cn(
            'h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300',
            urlInput.trim() && selectedCourseId && !isAnalyzing && importingId === null
              ? 'bg-teal-500 text-white shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-95'
              : 'bg-zinc-100 text-zinc-400',
          )}
        >
          {isAnalyzing
            ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> {isFeedInput ? 'Loading feed…' : 'Fetching episode…'}</span>
            : isFeedInput
              ? <span className="flex items-center gap-2"><Rss size={18} /> Browse Episodes</span>
              : <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Analyze Episode</span>}
        </Button>
      </motion.div>

      {recentPodcasts.length > 0 && (
        <motion.div variants={item} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-main">Recent Podcasts</h3>
            <RouterLink to="/library?type=audio" className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
              View All <ArrowRight size={12} />
            </RouterLink>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentPodcasts.map(doc => (
              <DocumentCard key={doc.id} doc={doc} course={getCourse(doc.courseId)} to={`/audio/${doc.id}`} compact />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

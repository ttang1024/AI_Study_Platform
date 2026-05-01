import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Rss, Link, Loader2, Zap, Brain, Captions, PlayCircle, Award } from 'lucide-react';
import { Button } from '../common/Button';
import { useStudy } from '../../context/StudyContext';
import { podcastService } from '../../services/podcastService';
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

export interface PodcastTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export const PodcastTab: React.FC<PodcastTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { documents, courses } = useStudy();
  const [urlInput, setUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState('');

  const dupPodcast = urlInput.trim()
    ? documents.filter(d => d.type === 'podcast').find(d => d.originalUrl === urlInput.trim()) ?? null
    : null;
  const dupPodcastCourse = dupPodcast?.courseId ? courses.find(c => c.id === dupPodcast.courseId) : undefined;

  const selectedCourseIdRef = useRef('');
  useEffect(() => { selectedCourseIdRef.current = selectedCourseId; }, [selectedCourseId]);

  const isApplePodcastsUrl = (url: string) => {
    try {
      const u = new URL(url.trim());
      return u.hostname === 'podcasts.apple.com' && u.searchParams.has('i');
    } catch {
      return false;
    }
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!isApplePodcastsUrl(trimmed)) {
      setError('Please enter a valid Apple Podcasts episode link (e.g. https://podcasts.apple.com/…?i=…)');
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
      setError(err?.response?.data?.message ?? 'Failed to fetch podcast episode. Please check the URL and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

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
              <p className="text-lg font-black tracking-tight text-zinc-900">Paste an Apple Podcasts link</p>
            </div>
            <div className="flex items-center justify-center gap-2">
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
                placeholder="https://podcasts.apple.com/us/podcast/…?i=…"
                className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 min-w-0"
              />
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

      <motion.div variants={item}>
        <Button
          disabled={!urlInput.trim() || isAnalyzing}
          onClick={handleAnalyze}
          className={cn(
            'h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300',
            urlInput.trim() && selectedCourseId && !isAnalyzing
              ? 'bg-teal-500 text-white shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-95'
              : 'bg-zinc-100 text-zinc-400',
          )}
        >
          {isAnalyzing
            ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Fetching episode…</span>
            : <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Analyze Episode</span>}
        </Button>
      </motion.div>
    </motion.div>
  );
};

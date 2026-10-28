import React, { useEffect, useRef, useState } from 'react';
import { PlayCircle, Volume2, VolumeX } from 'lucide-react';
import { FadeIn } from './LandingAnimations';
import { Badge } from './Badge';

/**
 * Chapter start times in the tour, in seconds. Copied from scripts/promo-video/timeline.mjs, which
 * the video is rendered from — re-copy them if the timeline changes and the video is re-rendered.
 */
const CHAPTERS: { label: string; at: number }[] = [
  { label: 'Bring anything', at: 4.8 },
  { label: 'AI summaries', at: 9.6 },
  { label: 'Mind maps', at: 14.4 },
  { label: 'Flashcards', at: 18.6 },
  { label: 'Quizzes', at: 23.4 },
  { label: 'Glossary & problems', at: 27.6 },
  { label: 'Ask your library', at: 32.4 },
  { label: 'AI tutor', at: 36.6 },
  { label: 'Spaced repetition', at: 40.8 },
  { label: 'Planner & exams', at: 45.6 },
  { label: 'Notes & audio', at: 49.8 },
  { label: 'Search', at: 54 },
  { label: 'Groups & sharing', at: 57.6 },
  { label: 'Everywhere', at: 62.4 },
  { label: 'Your keys', at: 66.6 },
];

/**
 * The product tour, rendered from scripts/promo-video/ (see render.mjs there). It plays muted and
 * looped only while on screen and doesn't fetch until the section nears the viewport, so it costs
 * the hero nothing. Reduced-motion visitors get the poster and controls instead of autoplay.
 */
export const IntroVideoSection: React.FC = () => {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [chapter, setChapter] = useState(-1);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (video.preload === 'none') video.preload = 'auto';
        // A blocked autoplay just leaves the poster and controls up — nothing to handle.
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, { threshold: 0.35 });
    io.observe(video);
    return () => io.disconnect();
  }, []);

  const onTimeUpdate = () => {
    const t = ref.current?.currentTime ?? 0;
    setChapter(CHAPTERS.reduce((current, c, i) => (t >= c.at ? i : current), -1));
  };

  const seek = (at: number) => {
    const video = ref.current;
    if (!video) return;
    if (video.preload === 'none') video.preload = 'auto';
    video.currentTime = at;
    video.play().catch(() => {});
  };

  const toggleSound = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted) video.play().catch(() => {});
  };

  return (
    <section className="relative px-6 pb-8">
      <FadeIn className="max-w-5xl mx-auto text-center">
        <Badge icon={PlayCircle} label="Product tour · 77 sec" />
        <div className="relative mt-2">
          <div className="absolute -inset-6 rounded-[2.5rem] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.22) 0%, transparent 70%)', filter: 'blur(40px)' }} />
          <div className="relative rounded-3xl overflow-hidden"
            style={{ border: '1px solid rgba(6,182,212,0.25)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), 0 0 60px rgba(6,182,212,0.12)' }}>
            <video
              ref={ref}
              className="block w-full aspect-video bg-[#030912]"
              poster="/video/toto-study-tour.jpg"
              muted
              loop
              playsInline
              controls
              preload="none"
              onTimeUpdate={onTimeUpdate}
              onVolumeChange={() => setMuted(ref.current?.muted ?? true)}
              aria-label="Toto Study product tour: importing documents and videos, AI summaries, mind maps, flashcards, quizzes, the AI tutor, spaced repetition, planner, notes, search, study groups, mobile apps and bring-your-own AI keys"
            >
              <source src="/video/toto-study-tour.mp4" type="video/mp4" />
            </video>
            <button
              type="button"
              onClick={toggleSound}
              className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors hover:bg-black/70"
              style={{ background: 'rgba(2,8,16,0.6)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              aria-label={muted ? 'Turn sound on' : 'Mute'}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {muted ? 'Sound on' : 'Mute'}
            </button>
          </div>
        </div>
        <nav aria-label="Tour chapters" className="mt-5 flex flex-wrap justify-center gap-2">
          {CHAPTERS.map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => seek(c.at)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={i === chapter
                ? { background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.5)', color: '#a5f3fc' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
            >
              {c.label}
            </button>
          ))}
        </nav>
      </FadeIn>
    </section>
  );
};

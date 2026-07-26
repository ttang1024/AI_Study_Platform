import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, animate } from 'motion/react';
import { ArrowRight, Play, Plus, CalendarCheck2 } from 'lucide-react';
import { CONTENT_TYPE_ICONS, STUDY_TYPE_ICONS } from '../constants/contentTypeIcons';
import { useAuth } from '../context/AuthContext';
import { useStudy } from '../context/StudyContext';
import { StudyCalendar } from '../components/common/StudyCalendar';
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist';
import { ReinforcementSummaryCards } from '../components/dashboard/ReinforcementSummaryCards';
import { XpDigestCards } from '../components/dashboard/XpDigestCards';
import { TodayProgressHero } from '../components/today/TodayProgressHero';
import { useDashboardSummary } from '../hooks/useDashboardSummary';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 30 } },
};
const cardItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 360, damping: 28 } },
};

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';
const CARD_SHADOW_HOVER = '0 2px 8px rgba(0,0,0,0.08), 0 12px 28px rgba(0,0,0,0.08)';

// ─── Animated number ──────────────────────────────────────────────────────────
const AnimatedCount: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: v => setDisplay(Math.round(v)) });
    return ctrl.stop;
  }, [inView, value]);
  return <span ref={ref} className={className}>{display}</span>;
};

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3 px-0.5">{children}</p>
);

// ─── Content library card ─────────────────────────────────────────────────────
interface ContentCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  link: string;
  summarizerTab: string;
}

const ContentCard: React.FC<ContentCardProps> = ({ label, value, icon: Icon, color, link, summarizerTab }) => {
  const isEmpty = value === 0;
  const destination = isEmpty ? `/summarizer${summarizerTab ? `?tab=${summarizerTab}` : ''}` : link;

  return (
    <motion.div variants={cardItem} whileTap={{ scale: 0.98 }}>
      <Link
        to={destination}
        className="group relative flex flex-col h-full bg-white rounded-2xl p-5 overflow-hidden transition-all duration-200 hover:-translate-y-px"
        style={{ boxShadow: CARD_SHADOW }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER)}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = CARD_SHADOW)}
      >
        {/* Large background icon */}
        <div
          className="pointer-events-none absolute -top-2 -right-4 opacity-[0.1] group-hover:opacity-[0.22] transition-opacity duration-300"
          style={{ color }}
        >
          <Icon size={100} strokeWidth={1.2} />
        </div>


        {isEmpty ? (
          <div className="flex-1 mt-1">
            <p className="text-sm font-semibold text-text-main leading-snug">Nothing yet</p>
            <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">Add your first {label.toLowerCase()}</p>
          </div>
        ) : (
          <div className="flex-1 mt-1">
            <AnimatedCount value={value} className="text-[40px] font-bold leading-none tabular-nums text-text-main tracking-tight" />
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between">
          <span className="text-[14px] font-bold text-text-muted">{label}</span>
          <span className="text-[11px] font-medium" style={{ color }}>{isEmpty ? 'Add now' : 'View all'}</span>
        </div>
      </Link>
    </motion.div>
  );
};

// ─── Study tool card ──────────────────────────────────────────────────────────
interface ToolCardProps {
  label: string;
  value: number | null;
  icon: React.ElementType;
  color: string;
  bg: string;
  link: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ label, value, icon: Icon, color, bg, link }) => (
  <motion.div variants={cardItem} whileTap={{ scale: 0.98 }}>
    <Link
      to={link}
      className="group flex items-center bg-white rounded-2xl px-5 py-4 overflow-hidden transition-all duration-200 hover:-translate-y-px"
      style={{ boxShadow: CARD_SHADOW }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = CARD_SHADOW)}
    >
      <div className="flex items-center gap-4 w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] origin-left">
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-text-muted mb-0.5">{label}</p>
          <p className="text-[26px] font-bold leading-none tabular-nums text-text-main tracking-tight">
            {value !== null ? <AnimatedCount value={value} /> : '—'}
          </p>
        </div>
        <ArrowRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
      </div>
    </Link>
  </motion.div>
);

// ─── Course card ──────────────────────────────────────────────────────────────
const CourseCard: React.FC<{ course: any; i: number; docCount: number; videoCount: number }> = ({ course, i, docCount, videoCount }) => {
  const total = docCount + videoCount;
  const isEmpty = total === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.05, type: 'spring' as const, stiffness: 320, damping: 28 }}
      whileTap={{ scale: 0.97 }}
    >
      <Link
        to={isEmpty ? `/summarizer?courseId=${course.id}` : `/courses/${course.id}/study`}
        className="group relative flex flex-col shrink-0 w-44 rounded-2xl bg-white p-4 overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-lg"
        style={{
          borderTop: `3px solid ${course.color}`,
        }}
      >
        <div className="relative z-10 flex flex-col flex-1 transition-transform duration-300 ease-out group-hover:scale-[1.04] origin-left">
          <p className="font-semibold text-[13px] leading-snug truncate text-text-main">
            {course.name}
          </p>
          <p className="text-[11px] mt-1 text-text-muted">
            {isEmpty ? 'No materials yet' : `${total} material${total !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-1 text-[11px] font-medium mt-3 text-text-muted">
            <span className="flex items-center gap-1 min-w-0">
              {isEmpty
                ? <><Plus size={10} /> Add first</>
                : <><Play size={10} /> Study now</>}
            </span>
            <ArrowRight size={11} className="opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 shrink-0" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const {
    totalDocuments, totalArticles, totalAudio, totalNotes,
    totalFlashcards, totalGlossaryTerms, totalQuizQuestions, totalVideos,
    courses, courseMaterialCounts,
  } = useStudy();
  const { summary, loading: summaryLoading } = useDashboardSummary();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

      {/* Greeting */}
      <motion.div variants={item}>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
          {greeting}, <span className="text-[var(--primary)]">{user?.name}</span>
        </h1>
      </motion.div>

      {/* ── Getting started: renders nothing once dismissed or complete ──── */}
      <motion.div variants={item}>
        <OnboardingChecklist />
      </motion.div>

      {/* ── Today's plan hero: progress, streak & next action ────────────── */}
      <motion.div variants={item}>
        <TodayProgressHero />
      </motion.div>

      {/* ── Courses ──────────────────────────────────────────────────────── */}
      {courses.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <SectionLabel>Your Courses</SectionLabel>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {courses.map((course, i) => {
              const counts = courseMaterialCounts.find(c => c.courseId === course.id);
              const docCount = (counts?.documents ?? 0) + (counts?.articles ?? 0) + (counts?.audio ?? 0);
              const videoCount = counts?.videos ?? 0;
              return <CourseCard key={course.id} course={course} i={i} docCount={docCount} videoCount={videoCount} />;
            })}
          </div>
        </motion.div>
      )}

      {/* ── Content Library ──────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <SectionLabel>Content Library</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Documents', value: totalDocuments, icon: CONTENT_TYPE_ICONS.document.icon, color: CONTENT_TYPE_ICONS.document.color, link: '/library?type=documents', summarizerTab: '' },
            { label: 'Videos', value: totalVideos, icon: CONTENT_TYPE_ICONS.video.icon, color: CONTENT_TYPE_ICONS.video.color, link: '/library?type=videos', summarizerTab: 'youtube' },
            { label: 'Articles', value: totalArticles, icon: CONTENT_TYPE_ICONS.article.icon, color: CONTENT_TYPE_ICONS.article.color, link: '/library?type=articles', summarizerTab: 'web' },
            { label: 'Audio', value: totalAudio, icon: CONTENT_TYPE_ICONS.audio.icon, color: CONTENT_TYPE_ICONS.audio.color, link: '/library?type=audio', summarizerTab: 'audio' },
          ].map(card => (
            <ContentCard key={card.label} {...card} />
          ))}
        </div>
      </motion.div>

      {/* ── Study Tools ──────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Study Tools</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            { label: 'Flashcards', value: totalFlashcards, icon: STUDY_TYPE_ICONS.flashcard.icon, color: STUDY_TYPE_ICONS.flashcard.color, bg: STUDY_TYPE_ICONS.flashcard.bg, link: '/flashcards' },
            { label: 'Quizzes', value: totalQuizQuestions, icon: STUDY_TYPE_ICONS.quiz.icon, color: STUDY_TYPE_ICONS.quiz.color, bg: STUDY_TYPE_ICONS.quiz.bg, link: '/quizzes' },
            { label: 'Notes', value: totalNotes, icon: STUDY_TYPE_ICONS.notes.icon, color: STUDY_TYPE_ICONS.notes.color, bg: STUDY_TYPE_ICONS.notes.bg, link: '/notes' },
            { label: 'Glossary', value: totalGlossaryTerms, icon: STUDY_TYPE_ICONS.glossary.icon, color: STUDY_TYPE_ICONS.glossary.color, bg: STUDY_TYPE_ICONS.glossary.bg, link: '/glossary' },
          ] as ToolCardProps[]).map(tool => (
            <ToolCard key={tool.label} {...tool} />
          ))}
        </div>
      </motion.div>

      {/* ── Reinforcement Center ─────────────────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Reinforcement Center</p>
          <Link to="/insights?tab=reinforcement" className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--primary)] hover:opacity-75 transition-opacity">
            <CalendarCheck2 size={13} />
            Open
          </Link>
        </div>
        <ReinforcementSummaryCards counts={summary?.reinforcement ?? null} loading={summaryLoading} />
      </motion.div>

      {/* ── XP & Weekly digest ───────────────────────────────────────────── */}
      <motion.div variants={item} className="space-y-3">
        <SectionLabel>Progress</SectionLabel>
        <XpDigestCards />
      </motion.div>

      {/* ── Study Calendar ────────────────────────────────────────────────── */}
      <motion.div variants={item} className="space-y-3">
        <SectionLabel>Study Calendar</SectionLabel>
        <StudyCalendar />
      </motion.div>

    </motion.div>
  );
};

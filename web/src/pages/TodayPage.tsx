import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Flame, ArrowRight, BrainCircuit, Award, BookMarked, Sigma,
  Lightbulb, GraduationCap, FileText, Check, Clock, Target, Sparkles, Pencil, Play,
} from 'lucide-react';
import { todayService, type TodayPlan, type TodayPlanItem, type TodayPlanItemType } from '../services/todayService';
import { analyticsService } from '../services/analyticsService';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 30 } },
};

// Per-type icon + accent, kept in sync with the recommendation/gap item types.
const TYPE_META: Record<TodayPlanItemType, { icon: React.ElementType; color: string; label: string }> = {
  flashcards: { icon: BrainCircuit,  color: '#0d9488', label: 'Flashcards' },
  quiz:       { icon: Award,         color: '#d97706', label: 'Quiz' },
  glossary:   { icon: BookMarked,    color: '#2563eb', label: 'Glossary' },
  problems:   { icon: Sigma,         color: '#7c3aed', label: 'Problems' },
  gap:        { icon: Lightbulb,     color: '#dc2626', label: 'Knowledge gap' },
  course:     { icon: GraduationCap, color: '#0891b2', label: 'Course' },
  material:   { icon: FileText,      color: '#64748b', label: 'Material' },
};

const doneStorageKey = (date: string) => `today-plan-done:${date}`;
const todayKey = () => new Date().toISOString().slice(0, 10);

// ─── Progress ring ──────────────────────────────────────────────────────────────
const ProgressRing: React.FC<{ percent: number; size?: number }> = ({ percent, size = 128 }) => {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(percent, 100) / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(13,148,136,0.12)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
};

// ─── Plan item card ─────────────────────────────────────────────────────────────
const PlanItemCard: React.FC<{ item: TodayPlanItem; done: boolean; onToggle: () => void }> = ({ item, done, onToggle }) => {
  const meta = TYPE_META[item.type] ?? TYPE_META.material;
  const Icon = meta.icon;

  const body = (
    <div
      className={`group relative h-full flex flex-col rounded-2xl bg-white pl-5 pr-4 py-4 overflow-hidden transition-all duration-200 ${done ? 'opacity-60' : 'hover:-translate-y-0.5'}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      {/* Type accent bar */}
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: meta.color }} />

      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}14` }}>
          <Icon size={18} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</p>
          <p className={`text-[15px] font-semibold text-text-main leading-snug line-clamp-2 ${done ? 'line-through' : ''}`}>{item.title}</p>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onToggle(); }}
          className={`shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${done ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-zinc-300 text-transparent hover:border-[var(--primary)]'}`}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
        >
          <Check size={15} strokeWidth={3} />
        </button>
      </div>

      <p className="text-[13px] text-text-muted leading-snug line-clamp-2 mt-2 flex-1">{item.subtitle}</p>

      <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted tabular-nums">
          <Clock size={13} /> ~{item.estimatedMinutes} min
        </span>
        {item.url && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)] opacity-70 group-hover:opacity-100 transition-opacity">
            Start <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </div>
    </div>
  );

  return item.url ? <Link to={item.url} className="block h-full">{body}</Link> : body;
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export const TodayPage: React.FC = () => {
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  useEffect(() => {
    // Restore today's locally-tracked completions.
    try {
      const raw = localStorage.getItem(doneStorageKey(todayKey()));
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore corrupt storage */ }

    todayService.getTodayPlan()
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, []);

  const toggleDone = (id: string) => {
    setDone(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(doneStorageKey(todayKey()), JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const saveGoal = async () => {
    const minutes = parseInt(goalDraft, 10);
    setEditingGoal(false);
    if (!Number.isFinite(minutes) || !plan || minutes === plan.dailyGoalMinutes) return;
    const clamped = Math.max(5, Math.min(600, minutes));
    setPlan({ ...plan, dailyGoalMinutes: clamped });
    try {
      await analyticsService.updateDailyGoal(clamped);
      setPlan(await todayService.getTodayPlan());
    } catch { /* keep optimistic value */ }
  };

  const { core, stretch } = useMemo(() => {
    const items = plan?.items ?? [];
    return {
      core: items.filter(i => !i.stretch),
      stretch: items.filter(i => i.stretch),
    };
  }, [plan]);

  const coreRemaining = core.filter(i => !done.has(i.id)).length;
  const firstActionUrl = (core.find(i => !done.has(i.id) && i.url) ?? core.find(i => i.url))?.url ?? '/practice';
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-text-muted text-sm">Building your plan…</div>;
  }

  if (!plan) {
    return <div className="flex items-center justify-center py-24 text-text-muted text-sm">Couldn’t load today’s plan. Try again shortly.</div>;
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 w-full">

      {/* Heading */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)] mb-1">
          <Sparkles size={13} /> Today’s Plan
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">{greeting}</h1>
      </motion.div>

      {/* ── Progress hero (full width) ─────────────────────────────────── */}
      <motion.div variants={item}>
        <div className="relative bg-white rounded-3xl p-6 lg:p-8 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <Target size={220} strokeWidth={0.75} className="pointer-events-none absolute -right-10 -top-12 text-[var(--primary)] opacity-[0.05]" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-8">
            {/* Ring */}
            <div className="relative shrink-0 flex items-center justify-center self-center">
              <ProgressRing percent={plan.completionPercent} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[30px] font-bold leading-none tabular-nums text-text-main">{plan.completionPercent}%</span>
                <span className="text-[10px] font-medium text-text-muted mt-0.5">of goal</span>
              </div>
            </div>

            {/* Stats + streak */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <Flame size={18} className={plan.streak.currentStreak > 0 ? 'text-orange-500' : 'text-zinc-300'} />
                <span className="text-[16px] font-semibold text-text-main">
                  {plan.streak.currentStreak > 0 ? `${plan.streak.currentStreak}-day streak` : 'Start a streak today'}
                </span>
                {plan.streak.longestStreak > 0 && (
                  <span className="text-[12px] text-text-muted">· best {plan.streak.longestStreak}</span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Studied today" value={`${plan.todayMinutes}m`} />
                <Stat label="Daily goal" value={`${plan.dailyGoalMinutes}m`} onEdit={() => { setGoalDraft(String(plan.dailyGoalMinutes)); setEditingGoal(true); }} editing={editingGoal} draft={goalDraft} onDraft={setGoalDraft} onSave={saveGoal} />
                <Stat label="Cards due" value={String(plan.dueFlashcards)} />
                <Stat label="Focus left" value={String(coreRemaining)} />
              </div>

              <p className="text-[13px] text-text-muted mt-4">
                {plan.goalMet
                  ? '🎉 Daily goal reached — anything below is a bonus.'
                  : coreRemaining === 0
                    ? 'Plan complete. Keep going with the stretch goals below.'
                    : `${coreRemaining} focus task${coreRemaining === 1 ? '' : 's'} left · ~${plan.plannedMinutes}m planned`}
              </p>
            </div>

            {/* CTA */}
            <div className="shrink-0 self-stretch lg:self-center flex lg:flex-col gap-2.5">
              <Link
                to={firstActionUrl}
                className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-6 py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Play size={16} /> Start session
              </Link>
              <Link
                to="/practice"
                className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 text-text-main px-6 py-3.5 text-[15px] font-bold hover:bg-zinc-200 transition-colors whitespace-nowrap"
              >
                <Award size={16} /> Practice test
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Focus ──────────────────────────────────────────────────────── */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center gap-2 px-0.5">
          <Target size={14} className="text-[var(--primary)]" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Today’s Focus</p>
          {core.length > 0 && <span className="text-[11px] text-text-muted tabular-nums">· {core.length}</span>}
        </div>
        {core.length === 0 ? (
          <div className="bg-white rounded-2xl px-5 py-10 text-center" style={{ boxShadow: CARD_SHADOW }}>
            <Check size={28} className="mx-auto text-[var(--primary)] mb-2" />
            <p className="text-sm font-semibold text-text-main">You’re all caught up</p>
            <p className="text-[12px] text-text-muted mt-1">No reviews due. Add new material or revisit a course to keep momentum.</p>
            <Link to="/summarizer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)] mt-3 hover:opacity-75">
              Add material <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {core.map(i => <PlanItemCard key={i.id} item={i} done={done.has(i.id)} onToggle={() => toggleDone(i.id)} />)}
          </div>
        )}
      </motion.div>

      {/* ── Stretch goals ──────────────────────────────────────────────── */}
      {stretch.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <div className="flex items-center gap-2 px-0.5">
            <Sparkles size={14} className="text-text-muted" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Stretch Goals</p>
            <span className="text-[11px] text-text-muted tabular-nums">· {stretch.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {stretch.map(i => <PlanItemCard key={i.id} item={i} done={done.has(i.id)} onToggle={() => toggleDone(i.id)} />)}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─── Small stat tile (with optional inline edit for the goal) ───────────────────
const Stat: React.FC<{
  label: string; value: string;
  onEdit?: () => void; editing?: boolean; draft?: string;
  onDraft?: (v: string) => void; onSave?: () => void;
}> = ({ label, value, onEdit, editing, draft, onDraft, onSave }) => (
  <div className="rounded-2xl bg-zinc-50 px-4 py-3">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      {onEdit && !editing && (
        <button onClick={onEdit} className="text-text-muted hover:text-[var(--primary)] transition-colors" aria-label="Edit daily goal">
          <Pencil size={11} />
        </button>
      )}
    </div>
    {editing ? (
      <input
        autoFocus type="number" value={draft}
        onChange={e => onDraft?.(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => { if (e.key === 'Enter') onSave?.(); }}
        className="w-full mt-1 text-[22px] font-bold tabular-nums text-text-main bg-transparent border-b border-[var(--primary)] outline-none"
      />
    ) : (
      <p className="text-[22px] font-bold tabular-nums text-text-main mt-1">{value}</p>
    )}
  </div>
);

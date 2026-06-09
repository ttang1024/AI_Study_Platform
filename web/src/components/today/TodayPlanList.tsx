import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BrainCircuit, Award, BookMarked, Sigma,
  Lightbulb, GraduationCap, FileText, Check, Clock, Target, Sparkles,
} from 'lucide-react';
import { todayService, type TodayPlan, type TodayPlanItem, type TodayPlanItemType } from '../../services/todayService';
import { CARD_SHADOW, loadDone, persistDone } from './todayCommon';

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

// ─── Plan list ──────────────────────────────────────────────────────────────────
// The Focus + Stretch sections, formerly the body of the /today page. Now lives
// under the Insights → Analytics tab.
export const TodayPlanList: React.FC = () => {
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Set<string>>(loadDone);

  useEffect(() => {
    todayService.getTodayPlan()
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, []);

  const toggleDone = (id: string) => {
    setDone(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistDone(next);
      return next;
    });
  };

  const { core, stretch } = useMemo(() => {
    const items = plan?.items ?? [];
    return {
      core: items.filter(i => !i.stretch),
      stretch: items.filter(i => i.stretch),
    };
  }, [plan]);

  if (loading || !plan) return null;

  return (
    <div className="space-y-6">
      {/* ── Focus ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
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
      </div>

      {/* ── Stretch goals ──────────────────────────────────────────────── */}
      {stretch.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-0.5">
            <Sparkles size={14} className="text-text-muted" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Stretch Goals</p>
            <span className="text-[11px] text-text-muted tabular-nums">· {stretch.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {stretch.map(i => <PlanItemCard key={i.id} item={i} done={done.has(i.id)} onToggle={() => toggleDone(i.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
};

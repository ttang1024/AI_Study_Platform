import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BrainCircuit, Award, BookMarked, PencilRuler, FileText, GraduationCap,
  Compass, ArrowRight, Loader2,
} from 'lucide-react';
import { recommendationService, type RecommendationItem, type RecommendationType } from '../../services/recommendationService';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

const TYPE_META: Record<RecommendationType, { icon: React.ElementType; tint: string }> = {
  flashcards: { icon: BrainCircuit, tint: '#0d9488' },
  quiz: { icon: Award, tint: '#d97706' },
  glossary: { icon: BookMarked, tint: '#7c3aed' },
  problems: { icon: PencilRuler, tint: '#dc2626' },
  material: { icon: FileText, tint: '#2563eb' },
  course: { icon: GraduationCap, tint: '#0891b2' },
};

const RecoCard: React.FC<{ item: RecommendationItem; i: number }> = ({ item, i }) => {
  const meta = TYPE_META[item.type] ?? TYPE_META.material;
  const Icon = meta.icon;
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className="group flex items-start gap-3 bg-white rounded-2xl p-4 h-full transition-all duration-200 hover:-translate-y-px"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${meta.tint}14` }}>
        <Icon size={17} style={{ color: meta.tint }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text-main leading-snug line-clamp-2">{item.title}</p>
        <p className="text-[11px] text-text-muted mt-0.5 leading-snug line-clamp-2">{item.reason}</p>
      </div>
      {item.url && (
        <ArrowRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      )}
    </motion.div>
  );
  return item.url ? <Link to={item.url} className="block h-full">{inner}</Link> : inner;
};

// Surfaces only "next best content" (new material worth exploring). The review
// queue is intentionally omitted — it already lives in the Today plan.
export const NextBestContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [nextBest, setNextBest] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    recommendationService.getRecommendations()
      // `?? []` because a response without the field should read as "no recommendations", not
      // throw below and take the whole page down with it.
      .then(r => { if (!cancelled) setNextBest(r.nextBestContent ?? []); })
      .catch(() => { /* empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-[var(--primary)]" size={20} />
      </div>
    );
  }

  if (nextBest.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <Compass size={14} className="text-text-muted" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Explore next</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {nextBest.map((item, i) => <RecoCard key={item.id} item={item} i={i} />)}
      </div>
    </div>
  );
};

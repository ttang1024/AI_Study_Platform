import React from 'react';
import { XCircle, BookMarked, BrainCircuit } from 'lucide-react';
import type { ReinforcementCounts } from '../../services/analyticsService';
import { ReinforcementModuleCard, ReinforcementModuleCardDef } from '../reinforcement/ReinforcementModuleCard';

/**
 * The three reinforcement-center counts. These now come from the consolidated dashboard-summary
 * endpoint (computed server-side) instead of pulling every quiz submission, flashcard, and glossary
 * term to the browser to crunch on each dashboard load.
 */
export const ReinforcementSummaryCards: React.FC<{ counts?: ReinforcementCounts | null; loading?: boolean }> = ({ counts = null, loading = false }) => {
  const cards: ReinforcementModuleCardDef[] = [
    {
      id: 'quiz',
      icon: <XCircle size={18} />,
      title: 'Quiz Mistakes',
      count: counts?.quizMistakes ?? 0,
      loading,
      color: 'text-red-500',
      iconBg: 'bg-red-100',
      activeBg: 'bg-red-50',
      activeBorder: 'border-red-200',
      activeShadow: '0 1px 3px rgba(239,68,68,0.1), 0 6px 20px rgba(239,68,68,0.08)',
    },
    {
      id: 'glossary',
      icon: <BookMarked size={18} />,
      title: 'Unmastered Terms',
      count: counts?.unmasteredTerms ?? 0,
      loading,
      color: 'text-amber-500',
      iconBg: 'bg-amber-100',
      activeBg: 'bg-amber-50',
      activeBorder: 'border-amber-200',
      activeShadow: '0 1px 3px rgba(245,158,11,0.1), 0 6px 20px rgba(245,158,11,0.08)',
    },
    {
      id: 'flashcards',
      icon: <BrainCircuit size={18} />,
      title: 'Hard Flashcards',
      count: counts?.hardFlashcards ?? 0,
      loading,
      color: 'text-[#059669]',
      iconBg: 'bg-[#059669]/15',
      activeBg: 'bg-[#059669]/5',
      activeBorder: 'border-[#059669]/30',
      activeShadow: '0 1px 3px rgba(5,150,105,0.1), 0 6px 20px rgba(5,150,105,0.08)',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(card => (
        <ReinforcementModuleCard
          key={card.id}
          {...card}
          to={`/insights?tab=reinforcement&module=${card.id}`}
          hoverActive
        />
      ))}
    </div>
  );
};

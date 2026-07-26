import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSignature, Languages, PenLine } from 'lucide-react';
import { HandwritingTab } from './tools/HandwritingTab';
import { EssaysTab } from './tools/EssaysTab';
import { LanguageTab } from './tools/LanguageTab';
import { cn } from '../utils/cn';

type Tab = 'working' | 'writing' | 'language';

const TABS: { id: Tab; label: string; icon: typeof PenLine; blurb: string }[] = [
  {
    id: 'working',
    label: 'Check working',
    icon: PenLine,
    blurb: 'Photograph a worked solution and find out where the reasoning first went wrong — not just whether the final answer matched.',
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: FileSignature,
    blurb: 'Mark a draft against a rubric, then revise and re-mark it.',
  },
  {
    id: 'language',
    label: 'Language',
    icon: Languages,
    blurb: 'Say a phrase and have it checked, or turn a sentence you met into a review card.',
  },
];

const isTab = (value: string | null): value is Tab => TABS.some(t => t.id === value);

export const ToolsPage: React.FC = () => {
  // The old /handwriting, /essays and /language routes redirect here with ?tab=…, and the param is
  // kept in sync so a tab stays deep-linkable and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const active: Tab = isTab(param) ? param : 'working';

  // Each tab holds real work in progress — attached photos, an unsaved draft, a half-typed sentence.
  // So a tab is mounted on first visit and then only hidden, never unmounted.
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>([active]));

  const select = (tab: Tab) => {
    setVisited(prev => (prev.has(tab) ? prev : new Set(prev).add(tab)));
    setSearchParams(tab === 'working' ? {} : { tab }, { replace: true });
  };

  const current = TABS.find(t => t.id === active)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-text-main">
          Study <span className="text-[var(--primary)]">tools</span>
        </h1>
        <p className="text-sm text-text-muted mt-1 max-w-2xl">{current.blurb}</p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border-color)] overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => select(id)}
            aria-current={active === id ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
              active === id
                ? 'border-[var(--primary)] text-[var(--primary)] font-medium'
                : 'border-transparent text-text-muted hover:text-text-main',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {visited.has('working') && <div className={cn(active !== 'working' && 'hidden')}><HandwritingTab /></div>}
      {visited.has('writing') && <div className={cn(active !== 'writing' && 'hidden')}><EssaysTab /></div>}
      {visited.has('language') && <div className={cn(active !== 'language' && 'hidden')}><LanguageTab /></div>}
    </div>
  );
};

export default ToolsPage;

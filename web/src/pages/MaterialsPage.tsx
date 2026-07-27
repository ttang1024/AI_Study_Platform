import React from 'react';
import { BookMarked, NotebookPen } from 'lucide-react';
import { NotesTab } from './materials/NotesTab';
import { GlossaryTab } from './materials/GlossaryTab';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';

type Tab = 'notes' | 'glossary';

// Both halves are the same shape — everything your sources produced, filtered by source, paged,
// playable, and cached for offline. They differ only in what the unit is: a note or a term.
const TABS: PageTab<Tab>[] = [
  {
    id: 'notes',
    label: 'Notes',
    icon: NotebookPen,
    panel: NotesTab,
    blurb: 'Capture your thoughts across every document & lecture.',
  },
  {
    id: 'glossary',
    label: 'Glossary',
    icon: BookMarked,
    panel: GlossaryTab,
    blurb: 'AI-extracted key terms and definitions from all your content.',
  },
];

const TAB_IDS = TABS.map(t => t.id);

export const MaterialsPage: React.FC = () => {
  // /notes and /glossary redirect here with ?tab=….
  const { active, select } = useTabParam(TAB_IDS, 'notes');
  const current = TABS.find(t => t.id === active)!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
          Study <span className="text-[var(--primary)]">materials</span>
        </h1>
        <PageTabBlurb tabKey={active}>{current.blurb}</PageTabBlurb>
      </div>

      <PageTabBar idPrefix="materials" ariaLabel="Study materials" tabs={TABS} active={active} onSelect={select} />
      <PageTabPanels idPrefix="materials" tabs={TABS} active={active} />
    </div>
  );
};

export default MaterialsPage;

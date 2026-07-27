import React from 'react';
import { Code2, FileSignature, Languages, PenLine } from 'lucide-react';
import { HandwritingTab } from './tools/HandwritingTab';
import { EssaysTab } from './tools/EssaysTab';
import { LanguageTab } from './tools/LanguageTab';
import { CodeTab } from './tools/CodeTab';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';

// `code` moved here from the Practice Center — it is a scratchpad, not a graded activity.
type Tab = 'working' | 'writing' | 'language' | 'code';

const TABS: PageTab<Tab>[] = [
  {
    id: 'working',
    label: 'Check working',
    icon: PenLine,
    panel: HandwritingTab,
    blurb: 'Photograph a worked solution and find where the reasoning first went wrong.',
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: FileSignature,
    panel: EssaysTab,
    blurb: 'Mark a draft against a rubric, then revise and re-mark it.',
  },
  {
    id: 'language',
    label: 'Language',
    icon: Languages,
    panel: LanguageTab,
    blurb: 'Say a phrase and have it checked, or turn a sentence you met into a review card.',
  },
  {
    id: 'code',
    label: 'Code',
    icon: Code2,
    panel: CodeTab,
    blurb: 'A Python scratchpad that runs in your browser.',
  },
];

const TAB_IDS = TABS.map(t => t.id);

export const ToolsPage: React.FC = () => {
  // The old /handwriting, /essays and /language routes redirect here with ?tab=….
  const { active, select } = useTabParam(TAB_IDS, 'working');
  const current = TABS.find(t => t.id === active)!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
          Study <span className="text-[var(--primary)]">tools</span>
        </h1>
        <PageTabBlurb tabKey={active}>{current.blurb}</PageTabBlurb>
      </div>

      <PageTabBar idPrefix="tools" ariaLabel="Study tools" tabs={TABS} active={active} onSelect={select} />
      <PageTabPanels idPrefix="tools" tabs={TABS} active={active} />
    </div>
  );
};

export default ToolsPage;

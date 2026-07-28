import React from 'react';
import { Library, Plus } from 'lucide-react';
import { BrowseTab } from './library/BrowseTab';
import { AddTab } from './library/AddTab';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';

type View = 'browse' | 'add';

const TABS: PageTab<View>[] = [
  {
    id: 'browse',
    label: 'Browse',
    icon: Library,
    panel: BrowseTab,
    blurb: 'Everything you have added — documents, videos, articles and audio.',
  },
  {
    id: 'add',
    label: 'Add content',
    icon: Plus,
    panel: AddTab,
    blurb: 'Turn a file, a link, a podcast or pasted text into study material.',
    // The Add panel lays itself out against the available height (a fixed course rail beside a
    // scrolling form) rather than growing with its content the way Browse does. `flex-1` off the
    // page's full-height flex column measures the header and tab bar instead of guessing at their
    // height in `vh` — the guess was what left dead space under the panel.
    panelClassName: 'flex-1 min-h-[520px]',
  },
];

const TAB_IDS = TABS.map(t => t.id);

export const LibraryPage: React.FC = () => {
  // `view` rather than `tab`: the Add panel is the old summarizer page and still owns `?tab=`
  // for its own input modes (document / video / web / audio / text).
  const { active, select } = useTabParam(TAB_IDS, 'browse', { param: 'view' });
  const current = TABS.find(t => t.id === active)!;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex shrink-0 flex-col gap-1">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-text-main">
          Content <span className="text-primary">Library</span>
        </h1>
        <PageTabBlurb tabKey={active}>{current.blurb}</PageTabBlurb>
      </div>

      <PageTabBar idPrefix="library" ariaLabel="Library" tabs={TABS} active={active} onSelect={select} />
      <PageTabPanels idPrefix="library" tabs={TABS} active={active} />
    </div>
  );
};

export default LibraryPage;

import { TABS } from '../../constants/tab';
import { cn } from '../../utils/cn';

export type StudyTabId = (typeof TABS)[number]['id'];

/**
 * The icon tab strip at the top of every study panel — document, article, audio and video all show
 * the same set of generated materials, so they show the same bar.
 */
export function StudyTabBar({ activeTab, onSelect }: {
  activeTab: StudyTabId;
  onSelect: (id: StudyTabId) => void;
}) {
  return (
    <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-x-auto no-scrollbar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0',
            activeTab === tab.id
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-text-muted hover:text-text-main',
          )}
        >
          <tab.icon size={15} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

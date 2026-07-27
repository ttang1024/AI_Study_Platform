import React from 'react';
import { School, Users } from 'lucide-react';
import { GroupsTab } from './spaces/GroupsTab';
import { ClassroomsTab } from './spaces/ClassroomsTab';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';

type Tab = 'groups' | 'classrooms';

// Two ways into the same idea — a shared space you enter with a code. Groups are peer-run and
// symmetric; classrooms have an instructor, an organization above them, and a gradebook.
const TABS: PageTab<Tab>[] = [
  {
    id: 'groups',
    label: 'Study groups',
    icon: Users,
    panel: GroupsTab,
    blurb: 'Collaborate and share resources with classmates.',
  },
  {
    id: 'classrooms',
    label: 'Classrooms',
    icon: School,
    panel: ClassroomsTab,
    blurb: 'Courses assigned by an instructor, and the classes you teach.',
  },
];

const TAB_IDS = TABS.map(t => t.id);

export const SpacesPage: React.FC = () => {
  // /groups and /classrooms redirect here with ?tab=….
  const { active, select } = useTabParam(TAB_IDS, 'groups');
  const current = TABS.find(t => t.id === active)!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
          Shared <span className="text-teal-600">spaces</span>
        </h1>
        <PageTabBlurb tabKey={active}>{current.blurb}</PageTabBlurb>
      </div>

      <PageTabBar idPrefix="spaces" ariaLabel="Shared spaces" tabs={TABS} active={active} onSelect={select} />
      <PageTabPanels idPrefix="spaces" tabs={TABS} active={active} />
    </div>
  );
};

export default SpacesPage;

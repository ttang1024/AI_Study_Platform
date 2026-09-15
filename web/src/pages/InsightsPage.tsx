import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Brain } from 'lucide-react';
import { AnalyticsSection } from '../components/dashboard/AnalyticsSection';
import { ActivityHeatmapSection } from '../components/dashboard/ActivityHeatmapSection';
import { ReinforcementPanel } from '../components/reinforcement/ReinforcementPanel';
import { RetentionSection } from '../components/dashboard/RetentionSection';
import { CalibrationSection } from '../components/dashboard/CalibrationSection';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';

type Tab = 'analytics' | 'retention';

/** Two kinds of calibration, side by side: RetentionSection grades the FSRS scheduler's predicted
 *  recall, CalibrationSection grades the learner's own sense of what they know. */
const RetentionPanel: React.FC = () => (
  <div className="space-y-6">
    <RetentionSection />
    <CalibrationSection />
  </div>
);

/** The year heatmap leads: it answers "did I actually study?" before the charts break it down,
 *  and the reinforcement modules close the loop by turning the weak spots into work. */
const AnalyticsPanel: React.FC = () => (
  <div className="space-y-6">
    <ActivityHeatmapSection />
    <AnalyticsSection />
    <ReinforcementPanel />
  </div>
);

const TABS: PageTab<Tab>[] = [
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    panel: AnalyticsPanel,
    blurb: 'Time on task, course mastery, and the weak spots worth reinforcing.',
  },
  {
    id: 'retention',
    label: 'Retention',
    icon: Brain,
    panel: RetentionPanel,
    blurb: 'How well the scheduler predicts your recall — and how well you predict it yourself.',
  },
];

const TAB_IDS = TABS.map(t => t.id);

export const InsightsPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Practice moved into the Practice Center. Old deep links still arrive here — forward them.
  const param = searchParams.get('tab');

  // `module` belongs to the reinforcement panel on Analytics; drop it when the user moves away.
  const { active, select } = useTabParam(TAB_IDS, 'analytics', {
    clearOnLeave: tab => (tab === 'analytics' ? [] : ['module']),
  });

  if (param === 'practice') {
    const smart = searchParams.get('smart');
    return <Navigate to={`/quizzes?tab=practice${smart ? `&smart=${smart}` : ''}`} replace />;
  }

  const current = TABS.find(t => t.id === active)!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
          Your <span className="text-[var(--primary)]">Insights</span>
        </h1>
        <PageTabBlurb tabKey={active}>{current.blurb}</PageTabBlurb>
      </div>

      <PageTabBar idPrefix="insights" ariaLabel="Insights" tabs={TABS} active={active} onSelect={select} />
      <PageTabPanels idPrefix="insights" tabs={TABS} active={active} />
    </div>
  );
};

export default InsightsPage;

import React, { lazy } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Target, Brain, Network, Award } from 'lucide-react';
import { AnalyticsSection } from '../components/dashboard/AnalyticsSection';
import { ActivityHeatmapSection } from '../components/dashboard/ActivityHeatmapSection';
import { ReinforcementPanel } from '../components/reinforcement/ReinforcementPanel';
import { RetentionSection } from '../components/dashboard/RetentionSection';
import { CalibrationSection } from '../components/dashboard/CalibrationSection';
import { CertificatesPanel } from '../components/insights/CertificatesPanel';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';

type Tab = 'analytics' | 'retention' | 'reinforcement' | 'graph' | 'certificates';

/** Two kinds of calibration, side by side: RetentionSection grades the FSRS scheduler's predicted
 *  recall, CalibrationSection grades the learner's own sense of what they know. */
const RetentionPanel: React.FC = () => (
  <div className="space-y-6">
    <RetentionSection />
    <CalibrationSection />
  </div>
);

/** The year heatmap leads: it answers "did I actually study?" before the charts break it down. */
const AnalyticsPanel: React.FC = () => (
  <div className="space-y-6">
    <ActivityHeatmapSection />
    <AnalyticsSection />
  </div>
);

// d3 and the graph simulation are worth ~a page of their own, so this tab stays behind a lazy
// import even though the rest of Insights is eager.
const GraphTab = lazy(() => import('./knowledgeGraph/GraphTab').then(m => ({ default: m.GraphTab })));

const TABS: PageTab<Tab>[] = [
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    panel: AnalyticsPanel,
    blurb: 'Time on task, course mastery and how your week actually went.',
  },
  {
    id: 'retention',
    label: 'Retention',
    icon: Brain,
    panel: RetentionPanel,
    blurb: 'How well the scheduler predicts your recall — and how well you predict it yourself.',
  },
  {
    id: 'reinforcement',
    label: 'Reinforcement',
    icon: Target,
    panel: ReinforcementPanel,
    blurb: 'Strengthen weak areas from quiz mistakes, hard flashcards and unmastered terms.',
  },
  {
    // Sits after the mastery views it is earned from — the score on the Analytics tab is the same
    // number that unlocks a certificate here.
    id: 'certificates',
    label: 'Certificates',
    icon: Award,
    panel: CertificatesPanel,
    blurb: 'Claim and share proof of the courses you have mastered.',
  },
  {
    id: 'graph',
    label: 'Concept map',
    icon: Network,
    panel: GraphTab,
    blurb: 'Connect concepts, notes, quizzes, flashcards and materials across courses.',
  },
];

const TAB_IDS = TABS.map(t => t.id);

export const InsightsPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Practice moved into the Practice Center, and the old standalone /knowledge-graph page is the
  // Concept map tab below. Old deep links still arrive here — forward the practice ones.
  const param = searchParams.get('tab');

  // `module` belongs to Reinforcement; drop it when the user moves to another tab.
  const { active, select } = useTabParam(TAB_IDS, 'analytics', {
    clearOnLeave: tab => (tab === 'reinforcement' ? [] : ['module']),
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

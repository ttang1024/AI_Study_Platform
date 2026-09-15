import React from 'react';
import { useStudy } from '../context/StudyContext';
import { Loader2, Download, GraduationCap, CalendarClock, History, XCircle } from 'lucide-react';
import { TimedExamModal } from '../components/quiz/TimedExamModal';
import { ShareModal } from '../components/common/ShareModal';
import { MistakesNotebook } from '../components/quiz/MistakesNotebook';
import { PracticeSection } from '../components/practice/PracticeSection';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';
import { MainTab } from './quizManagement/types';
import { useQuizHistory } from './quizManagement/useQuizHistory';
import { QuizHistoryTab } from './quizManagement/QuizHistoryTab';
import { PlannerTab } from './planner/PlannerTab';

const TAB_IDS: MainTab[] = ['practice', 'planner', 'history', 'mistakes'];

export const QuizManagementPage: React.FC = () => {
  const { isLoading: contextLoading } = useStudy();
  // /practice, /planner and /mistakes redirect here with ?tab=….
  const { active: mainTab, select: setMainTab } = useTabParam<MainTab>(TAB_IDS, 'practice');

  const history = useQuizHistory();

  useRefreshOnVisible(React.useCallback(async () => {
    await Promise.all([
      history.refreshQuizSubmissions(),
      history.refreshStats(),
      history.refreshDocuments(),
      history.refreshGeneratedMaterials(),
      history.refreshCoverage(),
      history.refreshPendingItems(),
      history.refreshVideos(),
    ]);
    // 7+ requests per burst — cap to once a minute rather than every tab switch.
  }, [history]), 60_000);

  // Practice, Planner and Mistakes are self-contained; History is driven by this page's
  // hooks, so it comes in as an element (see PageTab).
  const TABS: PageTab<MainTab>[] = [
    {
      id: 'practice',
      label: 'Practice',
      icon: GraduationCap,
      panel: PracticeSection,
      blurb: 'Practice tests and smart sessions built from what you are due to review.',
    },
    {
      id: 'planner',
      label: 'Planner',
      icon: CalendarClock,
      panel: PlannerTab,
      blurb: 'Set an exam date — your daily plan blends due reviews, knowledge gaps and practice.',
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      blurb: 'Every quiz you have taken, by source and by course.',
      content: <QuizHistoryTab history={history} contextLoading={contextLoading} />,
    },
    {
      id: 'mistakes',
      label: 'Review mistakes',
      icon: XCircle,
      panel: MistakesNotebook,
      blurb: 'The questions you got wrong, kept until you close them out.',
    },
  ];

  const currentTab = TABS.find(t => t.id === mainTab)!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-text-main">
            Practice <span className="text-primary">Center</span>
          </h1>
          <PageTabBlurb tabKey={mainTab}>{currentTab.blurb}</PageTabBlurb>
        </div>
        {mainTab === 'history' && history.docStats.totalTaken > 0 && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)]/70 p-1">
              {(['csv', 'gift', 'qti'] as const).map(format => (
                <button
                  key={format}
                  onClick={() => history.handleExportQuizzes(format)}
                  disabled={!!history.exporting}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-text-main hover:bg-white disabled:opacity-50"
                >
                  {history.exporting === format ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-teal-400/30 bg-teal-50/50 px-4 py-2 text-center">
              <p className="text-xl font-bold text-teal-600">{history.docStats.avgScore}%</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-500/70">avg score</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-50/50 px-4 py-2 text-center">
              <p className="text-xl font-bold text-emerald-600">{history.docStats.perfectScores}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">perfect</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)]/70 px-4 py-2 text-center">
              <p className="text-xl font-bold text-text-main">{history.docStats.totalTaken}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">taken</p>
            </div>
          </div>
        )}
      </div>

      <PageTabBar
        idPrefix="quizzes"
        ariaLabel="Practice Center"
        tabs={TABS}
        active={mainTab}
        onSelect={setMainTab}
        variant="pill"
      />

      <PageTabPanels idPrefix="quizzes" tabs={TABS} active={mainTab} />

      {/* Timed exam modals */}
      <TimedExamModal
        isOpen={history.timedExamDocId !== null}
        onClose={() => history.setTimedExamDocId(null)}
        questions={history.timedExamQuestions}
        sourceTitle={history.timedExamDocName}
      />
      {history.shareTarget && (
        <ShareModal
          open={!!history.shareTarget}
          onClose={() => history.setShareTarget(null)}
          title={history.shareTarget.title}
          fetchQuizzes={history.shareTarget.fetchQuizzes}
          sourceType={history.shareTarget.sourceType}
          sourceUrl={history.shareTarget.sourceUrl}
          originalArticleUrl={history.shareTarget.originalArticleUrl}
        />
      )}
    </div>
  );
};

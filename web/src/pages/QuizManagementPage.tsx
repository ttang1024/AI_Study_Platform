import React, { useState } from 'react';
import { useStudy } from '../context/StudyContext';
import { Loader2, Download, Plus, GraduationCap, CalendarClock, History, ListChecks, XCircle } from 'lucide-react';
import { TimedExamModal } from '../components/quiz/TimedExamModal';
import { ShareModal } from '../components/common/ShareModal';
import { EditQuestionModal } from '../components/quiz/EditQuestionModal';
import { MistakesNotebook } from '../components/quiz/MistakesNotebook';
import { QuestionBankTab } from '../components/quiz/QuestionBankTab';
import { PracticeSection } from '../components/practice/PracticeSection';
import { PageTab, PageTabBar, PageTabBlurb, PageTabPanels, useTabParam } from '../components/common/PageTabs';
import { Pagination } from '../components/common/Pagination';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';
import { MainTab } from './quizManagement/types';
import { useQuizHistory } from './quizManagement/useQuizHistory';
import { useQuestionBank } from './quizManagement/useQuestionBank';
import { QuizHistoryTab } from './quizManagement/QuizHistoryTab';
import { PlannerTab } from './planner/PlannerTab';

const TAB_IDS: MainTab[] = ['practice', 'planner', 'history', 'mistakes', 'bank'];

export const QuizManagementPage: React.FC = () => {
  const { isLoading: contextLoading } = useStudy();
  // /practice, /planner and /mistakes redirect here with ?tab=….
  const { active: mainTab, select: setMainTab } = useTabParam<MainTab>(TAB_IDS, 'practice');

  const history = useQuizHistory();
  const bank = useQuestionBank(mainTab);

  // Reveal-answer toggle for the Question-Bank tab.
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());
  const toggleAnswer = (id: string) => {
    setRevealedAnswers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  // Practice, Planner and Mistakes are self-contained; History and Question Bank are driven
  // by this page's hooks, so they come in as elements (see PageTab).
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
    {
      id: 'bank',
      label: 'Question bank',
      icon: ListChecks,
      blurb: 'Every generated question in one place — filter it, edit it, or turn it into a mock exam.',
      content: (
        <>
          <QuestionBankTab
            courses={history.courses}
            loading={bank.bankLoading}
            search={bank.bankSearch}
            onSearchChange={s => bank.handleBankFilterChange(() => bank.setBankSearch(s))}
            courseId={bank.bankCourseId}
            onCourseChange={id => bank.handleBankFilterChange(() => bank.setBankCourseId(id))}
            difficulty={bank.bankDifficulty}
            onDifficultyChange={d => bank.handleBankFilterChange(() => bank.setBankDifficulty(d))}
            questions={bank.bankPagedQuestions}
            totalCount={bank.bankFiltered.length}
            selectedIds={bank.selectedIds}
            onSelect={bank.handleSelect}
            onSelectFiltered={() => bank.setSelectedIds(new Set(bank.bankFiltered.map(q => q.quizId)))}
            revealedAnswers={revealedAnswers}
            onToggleAnswer={toggleAnswer}
            onEdit={bank.setEditing}
            onDelete={bank.handleDeleteBankQuestion}
          />
          <Pagination
            page={bank.safeBankPage}
            totalPages={bank.bankTotalPages}
            onPageChange={(p) => { bank.setBankPage(p); document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); }}
            size="sm"
          />
        </>
      ),
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
        {mainTab === 'bank' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => bank.handleStartBankExam('selected')}
              disabled={bank.selectedQuestions.length === 0 && bank.bankFiltered.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              <Plus size={15} />
              Mock Exam
            </button>
            {(['csv', 'gift', 'qti'] as const).map(format => (
              <button
                key={format}
                onClick={() => bank.handleBankExport(format)}
                disabled={!!bank.bankExporting || bank.bankFiltered.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-3 py-2 text-xs font-bold text-text-main hover:border-primary/40 disabled:opacity-40"
              >
                {bank.bankExporting === format ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {format.toUpperCase()}
              </button>
            ))}
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

      {/* Edit question modal */}
      {bank.editing && (
        <EditQuestionModal
          editing={bank.editing}
          saving={bank.saving}
          onChange={bank.setEditing}
          onSave={bank.handleSaveEdit}
          onClose={() => bank.setEditing(null)}
        />
      )}

      {/* Timed exam modals */}
      <TimedExamModal
        isOpen={history.timedExamDocId !== null}
        onClose={() => history.setTimedExamDocId(null)}
        questions={history.timedExamQuestions}
        sourceTitle={history.timedExamDocName}
      />
      <TimedExamModal
        isOpen={bank.bankExamQuestions.length > 0}
        onClose={() => bank.setBankExamQuestions([])}
        questions={bank.bankExamQuestions}
        sourceTitle={bank.bankExamTitle}
        timeLimitMinutes={Math.max(5, Math.ceil(bank.bankExamQuestions.length * 1.5))}
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

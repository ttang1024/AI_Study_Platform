import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Download } from 'lucide-react';
import { CramSheetModal } from '../../components/planner/CramSheetModal';
import { MockExamRunner } from '../../components/planner/MockExamRunner';
import { ExamPlanList } from '../../components/planner/ExamPlanList';
import { MockExamLauncher } from '../../components/planner/MockExamLauncher';
import { PlannerSchedule } from '../../components/planner/PlannerSchedule';
import { useStudy } from '../../context/StudyContext';
import { usePlanner } from './usePlanner';

/** The Planner tab of the Practice Center. The old /planner route redirects to ?tab=planner. */
export const PlannerTab: React.FC = () => {
  const navigate = useNavigate();
  const { courses } = useStudy();
  const p = usePlanner();

  if (p.mockExam) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
            <Award size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-main">Mock Exam</h2>
            <p className="text-sm text-text-muted">{p.mockExam.questions.length} questions · suggested {p.mockExam.suggestedMinutes} min</p>
          </div>
        </div>
        <MockExamRunner exam={p.mockExam} onDone={() => { p.setMockExam(null); p.loadPlans(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Actions only — the title and blurb belong to the hub shell above the tab bar. */}
      <div className="flex justify-end">
        <button
          onClick={p.handleDownloadIcs}
          className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 px-3 py-2 rounded-lg text-gray-600 bg-white hover:text-black"
          title="Download .ics calendar with due cards, study blocks and exam dates"
        >
          <Download size={13} /> Calendar (.ics)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: plans + mock exam */}
        <div className="space-y-4">
          <ExamPlanList
            plans={p.plans}
            loading={p.loading}
            selectedPlanId={p.selectedPlanId}
            courses={courses}
            onSelect={p.setSelectedPlanId}
            onDelete={p.handleDelete}
            onCreated={p.addPlan}
          />
          <MockExamLauncher
            courses={courses}
            mockCourseId={p.mockCourseId}
            setMockCourseId={p.setMockCourseId}
            mockCount={p.mockCount}
            setMockCount={p.setMockCount}
            mockLoading={p.mockLoading}
            mockError={p.mockError}
            onStart={() => p.handleStartMock()}
          />
        </div>

        {/* Right: schedule */}
        <div className="lg:col-span-2">
          <PlannerSchedule
            schedule={p.schedule}
            scheduleLoading={p.scheduleLoading}
            busyByDate={p.busyByDate}
            onCram={p.setCramPlanId}
            onTaskNavigate={navigate}
          />
        </div>
      </div>

      {p.cramPlanId && <CramSheetModal planId={p.cramPlanId} onClose={() => p.setCramPlanId(null)} />}
    </div>
  );
};

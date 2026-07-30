import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Loader2 } from 'lucide-react';
import { SourceFilterBar } from '../../components/common/SourceFilterBar';
import { PendingItemsGrid } from '../../components/common/PendingItemsGrid';
import { QuizItemRow } from '../../components/quiz/QuizItemRow';
import { Pagination } from '../../components/common/Pagination';
import { getDocDisplayName } from '../../utils/docName';
import { docToQuizType } from './types';
import { useQuizHistory } from './useQuizHistory';

interface QuizHistoryTabProps {
  history: ReturnType<typeof useQuizHistory>;
  contextLoading: boolean;
}

export const QuizHistoryTab: React.FC<QuizHistoryTabProps> = ({ history, contextLoading }) => {
  const navigate = useNavigate();
  const {
    courses, documents, sourceType, selectedCourseId, counts, courseCounts, handleFilterChange,
    setSourceType, setSelectedCourseId, filteredItems, pagedItems, safePage, totalPages, setPage,
    allItems, loadingTimedExam, coverageLoading, pendingLoading, visiblePendingItems, pendingItemsCount,
    handleStartTimedExam, handleStartVideoTimedExam, handleShareQuiz, handleShareVideoQuiz,
    refreshQuizSubmissions, refreshStats, refreshGeneratedMaterials, refreshCoverage,
    refreshPendingItems, setGeneratedPending,
  } = history;

  return (
    <>
      <SourceFilterBar
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelectCourse={id => handleFilterChange(() => setSelectedCourseId(id))}
        sourceType={sourceType}
        onSelectType={t => handleFilterChange(() => setSourceType(t))}
        counts={counts}
        courseCounts={courseCounts}
        hideTypeTabs={true}
      />

      <div className="space-y-3 mt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-main">All Quizzes</h2>
          <span className="text-sm text-text-muted">{filteredItems.length} items</span>
        </div>

        {contextLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-12 text-center">
            <Award size={32} className="mb-4 text-zinc-300" />
            <h3 className="text-lg font-medium text-text-main">No quizzes found</h3>
            <p className="text-text-muted">Start a quiz from any document to see your results here.</p>
            {allItems.length === 0 && (
              <button
                onClick={() => navigate(documents.length > 0 ? '/library' : '/library/add')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                {documents.length > 0 ? 'Go to Library' : 'Add Content'}
              </button>
            )}
          </div>
        ) : (
          <>
            {pagedItems.map((item) => {
              if (item.type === 'video') {
                return (
                  <QuizItemRow
                    key={item.id}
                    type="video"
                    id={item.id}
                    name={item.name}
                    score={item.score}
                    total={item.total}
                    date={item.date}
                    courseName={item.courseName || undefined}
                    courseColor={item.courseColor || undefined}
                    pending={item.pending}
                    examKey={item.id}
                    loadingTimedExam={loadingTimedExam}
                    retakeState={item.targetQuizQuestionId ? { targetQuizQuestionId: item.targetQuizQuestionId } : undefined}
                    onShare={() => handleShareVideoQuiz(item.id, item.name)}
                    onExam={() => handleStartVideoTimedExam(item.id, item.name)}
                  />
                );
              }
              const docId = item.docId;
              return (
                <QuizItemRow
                  key={item.id}
                  type={item.type}
                  id={item.id}
                  name={item.name}
                  score={item.score}
                  total={item.total}
                  date={item.date}
                  courseName={item.courseName}
                  courseColor={item.courseColor}
                  docId={docId}
                  pending={item.pending}
                  examKey={docId ?? item.id}
                  loadingTimedExam={loadingTimedExam}
                  retakeState={item.targetQuizQuestionId ? { targetQuizQuestionId: item.targetQuizQuestionId } : undefined}
                  onShare={docId ? () => handleShareQuiz(docId, item.name, item.courseId ?? '') : undefined}
                  onExam={docId ? () => handleStartTimedExam(docId, item.name) : undefined}
                />
              );
            })}
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              size="sm"
            />
          </>
        )}
      </div>

      {!contextLoading && !coverageLoading && !pendingLoading && (
        <PendingItemsGrid
          items={visiblePendingItems}
          label="Not Yet Quizzed"
          activeTab="quiz"
          ctaText="Start"
          courses={courses}
          countOverride={pendingItemsCount}
          onGenerated={(item) => {
            if (item.kind === 'doc') {
              const doc = item.doc;
              const course = courses.find(c => c.id === doc.courseId);
              setGeneratedPending(prev => [
                ...prev.filter(p => p.type === 'video' || p.docId !== doc.id),
                {
                  type: docToQuizType(doc),
                  id: `pending-${doc.id}`,
                  name: getDocDisplayName(doc),
                  courseId: doc.courseId,
                  courseColor: course?.color,
                  courseName: course?.name,
                  docId: doc.id,
                  pending: true,
                },
              ]);
            }
            refreshQuizSubmissions();
            void refreshStats();
            void refreshGeneratedMaterials();
            void refreshCoverage();
            void refreshPendingItems();
          }}
        />
      )}
    </>
  );
};

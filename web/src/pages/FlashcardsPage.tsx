import React from 'react';
import { BrainCircuit, Loader2, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';
import { downloadApkg } from '../services/ankiExportService';
import { flashcardService } from '../services/flashcardService';
import { OcclusionEditorModal } from '../components/study/OcclusionEditorModal';
import { FlashcardImportModal } from '../components/study/FlashcardImportModal';
import { FlashcardSessionDeck } from '../components/study/FlashcardSessionCard';
import { FlashcardDetailView } from '../components/study/FlashcardDetailView';
import { SourceFilterBar } from '../components/common/SourceFilterBar';
import { PendingItemsGrid } from '../components/common/PendingItemsGrid';
import { Pagination } from '../components/common/Pagination';
import { FlashcardClassifyModal } from '../components/study/FlashcardClassifyModal';
import { ReviewQueueTab } from '../components/study/ReviewQueueTab';
import { ClassifyFilterBar } from '../components/study/ClassifyFilterBar';
import { FlashcardSetCard } from '../components/study/FlashcardSetCard';
import { useFlashcardsPage } from './flashcards/useFlashcardsPage';
import { FlashcardsHeader } from './flashcards/FlashcardsHeader';
import { ClassifiedCardList } from './flashcards/ClassifiedCardList';

export const FlashcardsPage: React.FC = () => {
  const navigate = useNavigate();
  const s = useFlashcardsPage();

  // Detail views
  if (s.selectedDocId) {
    return (
      <FlashcardDetailView
        kind="doc"
        docId={s.selectedDocId}
        doc={s.documents.find(d => d.id === s.selectedDocId)}
        flashcards={s.flashcards}
        onBack={() => s.setSelectedDocId(null)}
      />
    );
  }

  if (s.selectedVideo) {
    return (
      <FlashcardDetailView
        kind="video"
        video={s.selectedVideo}
        videoCards={s.videoCards}
        videoList={s.videoList}
        onBack={() => { s.setSelectedVideo(null); s.setVideoCards([]); }}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <FlashcardsHeader
        showToolbar={s.activeTab === 'sets'}
        searchQuery={s.searchQuery}
        onSearchChange={s.setSearchQuery}
        onImport={() => s.setShowImport(true)}
        onOcclusion={() => s.setShowOcclusionEditor(true)}
        onExportAnki={() => {
          s.setExporting(true);
          downloadApkg(s.selectedCourseId ?? undefined)
            .catch(() => alert('Nothing to export yet — create some flashcards first.'))
            .finally(() => s.setExporting(false));
        }}
        exporting={s.exporting}
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl  p-1  w-fit">
        {([
          { id: 'sets', label: 'My Sets', icon: BrainCircuit },
          { id: 'review', label: 'Review Queue', icon: CalendarDays },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => s.setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all',
              s.activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-text-main shadow-sm'
                : 'text-text-muted hover:text-text-main',
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {s.activeTab === 'review' && (
        <ReviewQueueTab flashcards={s.flashcards} />
      )}

      {s.activeTab === 'sets' && <>
        {/* Source + Course Filters */}
        <SourceFilterBar
          courses={s.courses}
          selectedCourseId={s.selectedCourseId}
          onSelectCourse={s.setSelectedCourseId}
          sourceType={s.sourceType}
          onSelectType={s.setSourceType}
          counts={s.counts}
          courseCounts={s.courseCounts}
          hideTypeTabs={true}
        />

        {/* Classification Filters */}
        <ClassifyFilterBar
          allTags={s.allTags}
          filterDifficulty={s.filterDifficulty}
          onDifficultyChange={s.setFilterDifficulty}
          filterChapter={s.filterChapter}
          onChapterChange={s.setFilterChapter}
          filterTags={s.filterTags}
          onTagsChange={s.setFilterTags}
          filteredCardCount={s.filteredCards.length}
        />

        {/* Content */}
        {s.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : s.classifyFiltersActive ? (
          <ClassifiedCardList
            cards={s.pagedCards}
            page={s.safeCardPage}
            totalPages={s.cardTotalPages}
            onPageChange={s.setCardPage}
            documents={s.documents}
            videoList={s.videoList}
            onClassify={s.setClassifyCard}
          />
        ) : s.filteredSets.length === 0 ? (
          /* ── Empty set state ─────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center bg-[var(--bg-sidebar)]">
            <div className="mb-4 rounded-2xl bg-zinc-100 p-6 text-zinc-300"><BrainCircuit size={40} /></div>
            <h3 className="text-lg font-bold text-text-main">No flashcard sets found</h3>
            <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-2">
              {s.searchQuery ? 'Try a different search term.' : 'Generate flashcards from a document or video to start learning.'}
            </p>
            {!s.searchQuery && s.allSets.length === 0 && (
              <button
                onClick={() => navigate(s.documents.length > 0 ? '/library' : '/library?view=add')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                {s.documents.length > 0 ? 'Go to Library' : 'Add Content'}
              </button>
            )}
          </div>
        ) : (
          /* ── Set grid ────────────────────────────────────────────────── */
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${s.sourceType}-${s.selectedCourseId}-${s.safePage}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {s.pagedSets.map((set) => (
                <FlashcardSetCard
                  key={`${set.type}-${set.id}`}
                  set={set}
                  onSelect={() => {
                    if (set.type === 'video') s.handleSelectVideo(set.id);
                    else if (set.id) s.setSelectedDocId(set.id);
                  }}
                  onMobileReview={() => s.openMobileReview(set)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {!s.classifyFiltersActive && (
          <Pagination
            page={s.safePage}
            totalPages={s.totalPages}
            onPageChange={s.setPage}
            size="sm"
          />
        )}

        {!s.isLoading && (
          <PendingItemsGrid
            items={s.pendingItems}
            label="Not Yet Generated"
            activeTab="flashcards"
            ctaText="Generate"
            courses={s.courses}
            countOverride={s.pendingItemsCount}
            onGenerated={() => {
              s.refreshFlashcards();
              void s.refreshCoverage();
              void s.refreshPendingItems();
            }}
          />
        )}
      </>}

      {s.mobileReview && (
        <FlashcardSessionDeck
          cards={s.mobileReview.cards}
          title={s.mobileReview.title}
          onClose={() => s.setMobileReview(null)}
        />
      )}

      {s.classifyCard && (
        <FlashcardClassifyModal
          card={s.classifyCard}
          allTags={s.allTags}
          allChapters={s.allChapters}
          onSave={async (data) => {
            await flashcardService.classifyFlashcard(s.classifyCard!.id, data);
            await s.refreshFlashcards();
          }}
          onDelete={async () => {
            await flashcardService.deleteFlashcard(s.classifyCard!.id);
            await s.refreshFlashcards();
          }}
          onClose={() => s.setClassifyCard(null)}
        />
      )}

      {s.showOcclusionEditor && (
        <OcclusionEditorModal
          onClose={() => s.setShowOcclusionEditor(false)}
          onCreated={() => { void s.refreshFlashcards(); void s.refreshStats(); }}
        />
      )}
      {s.showImport && (
        <FlashcardImportModal
          onClose={() => s.setShowImport(false)}
          onImported={() => { void s.refreshFlashcards(); void s.refreshStats(); }}
        />
      )}
    </motion.div>
  );
};

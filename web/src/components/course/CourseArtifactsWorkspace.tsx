import React, { useEffect, useMemo, useState } from 'react';
import { ArtifactMetric } from './ArtifactMetric';
import { ArtifactDetailModal } from './ArtifactDetailModal';
import { STUDY_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { Course, Document } from '../../types';
import { VideoListItem } from '../../services/videoService';
import { aiService, ChatSessionSummary } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { ArtifactKind } from './ArtifactSection';
import { AudioOverviewPanel } from './AudioOverviewPanel';
import { CourseArtifactSections } from './CourseArtifactSections';
import { useArtifactFilters } from './useArtifactFilters';
import { useArtifactDetail } from './useArtifactDetail';
import {
  CourseArtifacts,
  CourseStudySelected,
  OpenArtifactDetail,
  SourceTitleResolver,
  buildChatDetail,
  buildFlashcardDetail,
  buildGlossaryDetail,
  buildMindmapDetail,
  buildNoteDetail,
  buildProblemDetail,
  buildQuestionDetail,
  buildSourceRows,
  buildSummaryDetail,
  initialSectionPages,
  sourceKeyForSelected,
} from './artifactsWorkspaceModel';

// Compatibility re-exports: these types historically lived in this module.
export type { CourseStudySelected, CourseArtifacts, OpenArtifactDetail, ExternalMsg } from './artifactsWorkspaceModel';

interface CourseArtifactsWorkspaceProps {
  course: Course | null;
  documents: Document[];
  videos: VideoListItem[];
  selected: CourseStudySelected;
  setSelected: (selected: CourseStudySelected) => void;
  artifacts: CourseArtifacts;
  loading: boolean;
}

export const CourseArtifactsWorkspace: React.FC<CourseArtifactsWorkspaceProps> = ({
  course,
  documents,
  videos,
  selected,
  artifacts,
  loading,
}) => {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';

  const [artifactFilter, setArtifactFilter] = useState<'all' | 'current'>('all');
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKind | null>(null);
  const [sectionPages, setSectionPages] = useState<Record<ArtifactKind, number>>(initialSectionPages);

  // Pre-loaded chat sessions to know which materials have history
  const [chatSessions, setChatSessions] = useState<Map<string, ChatSessionSummary>>(new Map());

  const filters = useArtifactFilters(artifacts, artifactFilter, selected, userId);
  const detailState = useArtifactDetail(course);
  const { detail, setDetail } = detailState;

  const selectedKey = sourceKeyForSelected(selected);
  const docMap = useMemo(() => new Map(documents.map(d => [d.id, d])), [documents]);
  const videoMap = useMemo(() => new Map(videos.map(v => [v.id, v])), [videos]);

  const sourceTitle: SourceTitleResolver = (documentId, videoId, fallback = 'Course material') => {
    if (videoId) return videoMap.get(videoId)?.title ?? fallback;
    if (documentId) return docMap.get(documentId)?.name ?? fallback;
    return fallback;
  };

  const sourceRows = useMemo(() => buildSourceRows(documents, videos), [documents, videos]);

  const visibleRows = artifactFilter === 'current' && selectedKey
    ? sourceRows.filter(row => row.key === selectedKey)
    : sourceRows;

  const summaryRows = useMemo(() => visibleRows.filter(row => row.summary), [visibleRows]);
  const mindmapRows = useMemo(() => visibleRows.filter(row => row.mindMapText), [visibleRows]);
  const chatRows = useMemo(
    () => visibleRows.filter(row => chatSessions.has(row.documentId ?? row.videoId ?? '')),
    [visibleRows, chatSessions],
  );

  // Each section resets to page 1 when its filter changes; everything resets on scope change.
  useEffect(() => { setSectionPages(initialSectionPages); }, [artifactFilter, selectedKey]);
  useEffect(() => { setSectionPages(prev => ({ ...prev, flashcards: 1 })); }, [filters.flashcardDifficultyFilter]);
  useEffect(() => { setSectionPages(prev => ({ ...prev, questions: 1 })); }, [filters.questionFilter]);
  useEffect(() => { setSectionPages(prev => ({ ...prev, glossary: 1 })); }, [filters.glossaryFilter]);
  useEffect(() => { setSectionPages(prev => ({ ...prev, workedProblems: 1 })); }, [filters.workedProblemFilter]);

  const setSectionPage = (kind: ArtifactKind, page: number) => {
    setSectionPages(current => ({ ...current, [kind]: Math.max(1, page) }));
  };

  // Load chat sessions to know which materials have existing conversations
  useEffect(() => {
    if (!course) return;
    aiService.getChatSessions()
      .then(sessions => {
        const map = new Map<string, ChatSessionSummary>();
        sessions.forEach(s => {
          if (s.courseId !== course.id) return;
          // Sessions are per thread; keep the most recent thread per material.
          const existing = map.get(s.sourceId);
          if (!existing || new Date(s.updatedAt) > new Date(existing.updatedAt)) map.set(s.sourceId, s);
        });
        setChatSessions(map);
      })
      .catch(() => { });
  }, [course?.id]);

  const getDetailList = (kind: ArtifactKind): OpenArtifactDetail[] => {
    switch (kind) {
      case 'summaries': return summaryRows.map(buildSummaryDetail);
      case 'notes': return filters.artifactBuckets.notes.map(n => buildNoteDetail(n, sourceTitle));
      case 'flashcards': return filters.artifactBuckets.flashcards.map(f => buildFlashcardDetail(f, sourceTitle));
      case 'questions': return filters.artifactBuckets.questions.map(q => buildQuestionDetail(q, sourceTitle, filters.userAnswerMap));
      case 'glossary': return filters.artifactBuckets.glossary.map(g => buildGlossaryDetail(g, sourceTitle));
      case 'workedProblems': return filters.artifactBuckets.workedProblems.map(p => buildProblemDetail(p, sourceTitle));
      case 'mindmaps': return mindmapRows.map(buildMindmapDetail);
      case 'chats': return chatRows.map(buildChatDetail);
    }
  };

  const detailItems = detail ? getDetailList(detail.kind) : [];
  const detailIndex = detail ? detailItems.findIndex(item => item.itemKey === detail.itemKey) : -1;
  const detailPosition = detailIndex >= 0 ? detailIndex + 1 : 1;
  const detailCount = detailItems.length;

  const switchDetail = (direction: -1 | 1) => {
    if (!detail || detailItems.length <= 1 || detailIndex < 0) return;
    const nextIndex = (detailIndex + direction + detailItems.length) % detailItems.length;
    setDetail(detailItems[nextIndex]);
  };

  const handleMetricClick = (kind: ArtifactKind) => {
    setActiveArtifact(kind);
    window.requestAnimationFrame(() => {
      document.getElementById(`artifact-section-${kind}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const isMindmapOrChat = detail?.type === 'mindmap' || detail?.type === 'chat';

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-app)]">
      <div className="mx-auto max-w-7xl space-y-5 p-4 lg:p-6">

        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-text-main">{course?.name ?? 'Course'} artifacts</h1>
            <p className="mt-1 text-sm text-text-muted">Summaries, notes, flashcards, quizzes, glossary, problems, mind maps, and AI chats.</p>
          </div>
          <div className="flex rounded-xl border border-[var(--border-color)] bg-white p-1">
            {(['all', 'current'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setArtifactFilter(mode)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold capitalize',
                  artifactFilter === mode ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main',
                )}
              >
                {mode === 'all' ? 'All materials' : 'Selected only'}
              </button>
            ))}
          </div>
        </div>

        {course?.id && <AudioOverviewPanel courseId={course.id} />}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          <ArtifactMetric icon={STUDY_TYPE_ICONS.summary.icon}   label="Summaries" value={sourceRows.filter(r => r.summary).length} color={STUDY_TYPE_ICONS.summary.color}   active={activeArtifact === 'summaries'}     onClick={() => handleMetricClick('summaries')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.notes.icon}     label="Notes"     value={artifacts.notes.length}               color={STUDY_TYPE_ICONS.notes.color}     active={activeArtifact === 'notes'}         onClick={() => handleMetricClick('notes')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.flashcard.icon} label="Flashcards"value={artifacts.flashcards.length}           color={STUDY_TYPE_ICONS.flashcard.color} active={activeArtifact === 'flashcards'}     onClick={() => handleMetricClick('flashcards')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.quiz.icon}      label="Questions" value={artifacts.questions.length}            color={STUDY_TYPE_ICONS.quiz.color}      active={activeArtifact === 'questions'}     onClick={() => handleMetricClick('questions')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.glossary.icon}  label="Glossary"  value={artifacts.glossary.length}             color={STUDY_TYPE_ICONS.glossary.color}  active={activeArtifact === 'glossary'}      onClick={() => handleMetricClick('glossary')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.problems.icon}  label="Problems"  value={artifacts.workedProblems.length}        color={STUDY_TYPE_ICONS.problems.color}  active={activeArtifact === 'workedProblems'}onClick={() => handleMetricClick('workedProblems')} />
          {mindmapRows.length > 0 && (
            <ArtifactMetric icon={STUDY_TYPE_ICONS.mindmap.icon} label="Mind Maps" value={mindmapRows.length}                    color={STUDY_TYPE_ICONS.mindmap.color}   active={activeArtifact === 'mindmaps'}      onClick={() => handleMetricClick('mindmaps')} />
          )}
          {chatRows.length > 0 && (
            <ArtifactMetric icon={STUDY_TYPE_ICONS.chat.icon}    label="AI Chats"  value={chatRows.length}                       color={STUDY_TYPE_ICONS.chat.color}      active={activeArtifact === 'chats'}         onClick={() => handleMetricClick('chats')} />
          )}
        </div>

        {!loading && (
          <CourseArtifactSections
            activeArtifact={activeArtifact}
            filters={filters}
            sectionPages={sectionPages}
            onPageChange={setSectionPage}
            summaryRows={summaryRows}
            mindmapRows={mindmapRows}
            chatRows={chatRows}
            chatSessions={chatSessions}
            sourceTitle={sourceTitle}
            onOpenDetail={setDetail}
          />
        )}
      </div>

      {/* ── Detail modal ── */}
      {detail && (
        <ArtifactDetailModal
          detail={detail}
          isMindmapOrChat={isMindmapOrChat}
          detailCount={detailCount}
          detailPosition={detailPosition}
          revealAnswers={detailState.revealAnswers}
          mmText={detailState.mmText}
          mmGenerating={detailState.mmGenerating}
          mmStreaming={detailState.mmStreaming}
          mmError={detailState.mmError}
          chatLoading={detailState.chatLoading}
          chatMessages={detailState.chatMessages}
          togglingGlossaryId={filters.togglingGlossaryId}
          masteredIds={filters.masteredIds}
          togglingProblemId={filters.togglingProblemId}
          masteredProblemIds={filters.masteredProblemIds}
          onClose={() => setDetail(null)}
          onSwitch={switchDetail}
          onToggleReveal={detailState.toggleRevealAnswers}
          onGenerateMindMap={detailState.handleGenerateMindMap}
          onChatStreamSend={detailState.handleChatStreamSend}
          onToggleMastered={filters.handleToggleMastered}
          onToggleProblemMastered={filters.handleToggleProblemMastered}
        />
      )}
    </div>
  );
};

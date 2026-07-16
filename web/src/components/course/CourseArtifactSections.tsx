import React from 'react';
import { STUDY_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { HardFlashcardReview } from '../study/HardFlashcardCard';
import { ChatSessionSummary } from '../../services/aiService';
import { ArtifactKind, ArtifactSection } from './ArtifactSection';
import { FilterPills } from './FilterPills';
import {
  ARTIFACT_PAGE_SIZE,
  FLASHCARD_PAGE_SIZE,
  OpenArtifactDetail,
  SourceRow,
  SourceTitleResolver,
  buildChatDetail,
  buildGlossaryDetail,
  buildMindmapDetail,
  buildNoteDetail,
  buildProblemDetail,
  buildQuestionDetail,
  buildSummaryDetail,
} from './artifactsWorkspaceModel';
import { ArtifactFilters } from './useArtifactFilters';

const stripHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const emptyLine = <p className="text-sm text-text-muted">Nothing generated yet.</p>;

/** The card-list row every section renders: bold title line + muted detail line. */
const ItemButton: React.FC<{
  title: string;
  subtitle?: string;
  titleLines?: 1 | 2;
  subtitleLines?: 1 | 2;
  onClick: () => void;
}> = ({ title, subtitle, titleLines = 1, subtitleLines = 2, onClick }) => (
  <button onClick={onClick} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
    <p className={`${titleLines === 1 ? 'truncate' : 'line-clamp-2'} text-sm font-semibold text-text-main`}>{title}</p>
    {subtitle !== undefined && (
      <p className={`mt-1 ${subtitleLines === 1 ? 'line-clamp-1' : 'line-clamp-2'} text-xs text-text-muted`}>{subtitle}</p>
    )}
  </button>
);

interface CourseArtifactSectionsProps {
  activeArtifact: ArtifactKind | null;
  filters: ArtifactFilters;
  sectionPages: Record<ArtifactKind, number>;
  onPageChange: (kind: ArtifactKind, page: number) => void;
  summaryRows: SourceRow[];
  mindmapRows: SourceRow[];
  chatRows: SourceRow[];
  chatSessions: Map<string, ChatSessionSummary>;
  sourceTitle: SourceTitleResolver;
  onOpenDetail: (detail: OpenArtifactDetail) => void;
}

/** The eight paged artifact sections. Pure presentation over useArtifactFilters. */
export const CourseArtifactSections: React.FC<CourseArtifactSectionsProps> = ({
  activeArtifact,
  filters,
  sectionPages,
  onPageChange,
  summaryRows,
  mindmapRows,
  chatRows,
  chatSessions,
  sourceTitle,
  onOpenDetail,
}) => {
  const {
    artifactBuckets,
    failedQuestionIds,
    userAnswerMap,
    filteredFlashcards,
    filteredQuestions,
    filteredGlossary,
    filteredWorkedProblems,
    masteredIds,
    masteredProblemIds,
  } = filters;

  const getPagedItems = <T,>(kind: ArtifactKind, items: T[], pageSize = ARTIFACT_PAGE_SIZE) => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const page = Math.min(sectionPages[kind] ?? 1, totalPages);
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page, totalPages };
  };

  const pagedNotes = getPagedItems('notes', artifactBuckets.notes);
  const pagedFlashcards = getPagedItems('flashcards', filteredFlashcards, FLASHCARD_PAGE_SIZE);
  const pagedQuestions = getPagedItems('questions', filteredQuestions);
  const pagedGlossary = getPagedItems('glossary', filteredGlossary);
  const pagedWorkedProblems = getPagedItems('workedProblems', filteredWorkedProblems);
  const pagedSummaries = getPagedItems('summaries', summaryRows);
  const pagedMindmaps = getPagedItems('mindmaps', mindmapRows);
  const pagedChats = getPagedItems('chats', chatRows);

  const unmasteredGlossaryCount = artifactBuckets.glossary.filter(t => !masteredIds.has(t.id)).length;
  const unmasteredProblemCount = artifactBuckets.workedProblems.filter(p => !masteredProblemIds.has(p.workedProblemId)).length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

      {/* Notes */}
      <ArtifactSection id="notes" icon={STUDY_TYPE_ICONS.notes.icon} color={STUDY_TYPE_ICONS.notes.color} title="Notes" count={artifactBuckets.notes.length} page={pagedNotes.page} totalPages={pagedNotes.totalPages} onPageChange={page => onPageChange('notes', page)} activeArtifact={activeArtifact}>
        {artifactBuckets.notes.length === 0 ? emptyLine : pagedNotes.items.map(note => {
          const d = buildNoteDetail(note, sourceTitle);
          return <ItemButton key={note.id} title={d.title} subtitle={stripHtml(note.content)} onClick={() => onOpenDetail(d)} />;
        })}
      </ArtifactSection>

      {/* Flashcards */}
      <ArtifactSection
        id="flashcards"
        icon={STUDY_TYPE_ICONS.flashcard.icon}
        color={STUDY_TYPE_ICONS.flashcard.color}
        title="Flashcards"
        count={filteredFlashcards.length}
        page={pagedFlashcards.page}
        totalPages={pagedFlashcards.totalPages}
        onPageChange={page => onPageChange('flashcards', page)}
        activeArtifact={activeArtifact}
        headerExtra={
          <FilterPills
            value={filters.flashcardDifficultyFilter}
            onChange={key => filters.setFlashcardDifficultyFilter(key)}
            options={[
              { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
              { key: 'easy', label: 'Easy', activeClass: 'bg-blue-500 text-white' },
              { key: 'medium', label: 'Medium', activeClass: 'bg-orange-500 text-white' },
              { key: 'hard', label: 'Hard', activeClass: 'bg-[#059669] text-white' },
            ] as const}
          />
        }
      >
        {pagedFlashcards.items.length === 0
          ? emptyLine
          : <HardFlashcardReview key={`${filters.flashcardDifficultyFilter}-${pagedFlashcards.page}`} cards={pagedFlashcards.items} onRate={filters.handleFlashcardRate} />
        }
      </ArtifactSection>

      {/* Questions */}
      <ArtifactSection
        id="questions"
        icon={STUDY_TYPE_ICONS.quiz.icon}
        color={STUDY_TYPE_ICONS.quiz.color}
        title="Quizzes"
        count={filteredQuestions.length}
        page={pagedQuestions.page}
        totalPages={pagedQuestions.totalPages}
        onPageChange={page => onPageChange('questions', page)}
        activeArtifact={activeArtifact}
        headerExtra={
          <FilterPills
            value={filters.questionFilter}
            onChange={key => filters.setQuestionFilter(key)}
            options={[
              { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
              { key: 'mistakes', label: `Mistakes${failedQuestionIds.size > 0 ? ` (${failedQuestionIds.size})` : ''}`, activeClass: 'bg-red-500 text-white' },
            ] as const}
          />
        }
      >
        {filteredQuestions.length === 0
          ? (filters.questionFilter === 'mistakes'
            ? <p className="text-sm text-text-muted">No mistakes yet — keep quizzing!</p>
            : emptyLine)
          : pagedQuestions.items.map(question => (
            <ItemButton
              key={question.quizId}
              title={question.question}
              titleLines={2}
              subtitle={`${question.difficulty} · ${question.options.length} options`}
              onClick={() => onOpenDetail(buildQuestionDetail(question, sourceTitle, userAnswerMap))}
            />
          ))
        }
      </ArtifactSection>

      {/* Glossary */}
      <ArtifactSection
        id="glossary"
        icon={STUDY_TYPE_ICONS.glossary.icon}
        color={STUDY_TYPE_ICONS.glossary.color}
        title="Glossary Terms"
        count={filteredGlossary.length}
        page={pagedGlossary.page}
        totalPages={pagedGlossary.totalPages}
        onPageChange={page => onPageChange('glossary', page)}
        activeArtifact={activeArtifact}
        headerExtra={
          <FilterPills
            value={filters.glossaryFilter}
            onChange={key => filters.setGlossaryFilter(key)}
            options={[
              { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
              { key: 'unmastered', label: `Unmastered${filters.glossaryFilter === 'all' && artifactBuckets.glossary.length > 0 ? ` (${unmasteredGlossaryCount})` : ''}`, activeClass: 'bg-amber-500 text-white' },
            ] as const}
          />
        }
      >
        {filteredGlossary.length === 0
          ? (filters.glossaryFilter === 'unmastered'
            ? <p className="text-sm text-text-muted">All terms mastered — great work!</p>
            : emptyLine)
          : pagedGlossary.items.map(term => (
            <ItemButton key={term.id} title={term.term} subtitle={term.definition} onClick={() => onOpenDetail(buildGlossaryDetail(term, sourceTitle))} />
          ))
        }
      </ArtifactSection>

      {/* Worked Problems */}
      <ArtifactSection
        id="workedProblems"
        icon={STUDY_TYPE_ICONS.problems.icon}
        color={STUDY_TYPE_ICONS.problems.color}
        title="Worked Problems"
        count={filteredWorkedProblems.length}
        page={pagedWorkedProblems.page}
        totalPages={pagedWorkedProblems.totalPages}
        onPageChange={page => onPageChange('workedProblems', page)}
        activeArtifact={activeArtifact}
        headerExtra={
          <FilterPills
            value={filters.workedProblemFilter}
            onChange={key => filters.setWorkedProblemFilter(key)}
            options={[
              { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
              { key: 'unmastered', label: `Unmastered${filters.workedProblemFilter === 'all' && artifactBuckets.workedProblems.length > 0 ? ` (${unmasteredProblemCount})` : ''}`, activeClass: 'bg-amber-500 text-white' },
            ] as const}
          />
        }
      >
        {filteredWorkedProblems.length === 0
          ? (filters.workedProblemFilter === 'unmastered'
            ? <p className="text-sm text-text-muted">All problems mastered — great work!</p>
            : emptyLine)
          : pagedWorkedProblems.items.map(problem => (
            <ItemButton
              key={problem.workedProblemId}
              title={problem.problemText}
              titleLines={2}
              subtitle={`${problem.difficulty} · ${problem.steps.length} steps`}
              onClick={() => onOpenDetail(buildProblemDetail(problem, sourceTitle))}
            />
          ))
        }
      </ArtifactSection>

      {/* Summaries */}
      <ArtifactSection id="summaries" icon={STUDY_TYPE_ICONS.summary.icon} color={STUDY_TYPE_ICONS.summary.color} title="Summaries" count={summaryRows.length} page={pagedSummaries.page} totalPages={pagedSummaries.totalPages} onPageChange={page => onPageChange('summaries', page)} activeArtifact={activeArtifact}>
        {summaryRows.length === 0 ? emptyLine : pagedSummaries.items.map(row => (
          <ItemButton key={row.key} title={row.title} subtitle={row.summary ?? undefined} onClick={() => onOpenDetail(buildSummaryDetail(row))} />
        ))}
      </ArtifactSection>

      {/* Mind Maps */}
      {mindmapRows.length > 0 && (
        <ArtifactSection id="mindmaps" icon={STUDY_TYPE_ICONS.mindmap.icon} color={STUDY_TYPE_ICONS.mindmap.color} title="Mind Maps" count={mindmapRows.length} page={pagedMindmaps.page} totalPages={pagedMindmaps.totalPages} onPageChange={page => onPageChange('mindmaps', page)} activeArtifact={activeArtifact}>
          {pagedMindmaps.items.map(row => (
            <ItemButton
              key={row.key}
              title={row.title}
              subtitle={`${row.sourceKind === 'doc' ? 'Document' : 'Video'} · click to view`}
              onClick={() => onOpenDetail(buildMindmapDetail(row))}
            />
          ))}
        </ArtifactSection>
      )}

      {/* AI Chats */}
      {chatRows.length > 0 && (
        <ArtifactSection id="chats" icon={STUDY_TYPE_ICONS.chat.icon} color={STUDY_TYPE_ICONS.chat.color} title="AI Chats" count={chatRows.length} page={pagedChats.page} totalPages={pagedChats.totalPages} onPageChange={page => onPageChange('chats', page)} activeArtifact={activeArtifact}>
          {pagedChats.items.map(row => {
            const session = chatSessions.get(row.documentId ?? row.videoId ?? '');
            return (
              <ItemButton
                key={row.key}
                title={row.title}
                subtitle={session?.lastMessage}
                subtitleLines={1}
                onClick={() => onOpenDetail(buildChatDetail(row))}
              />
            );
          })}
        </ArtifactSection>
      )}

    </div>
  );
};

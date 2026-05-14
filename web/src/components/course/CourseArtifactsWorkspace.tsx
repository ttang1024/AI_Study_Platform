import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookMarked,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  NotebookPen,
  X,
} from 'lucide-react';
import { Course, Document, Flashcard, GlossaryTerm, Note } from '../../types';
import { VideoListItem } from '../../services/youtubeService';
import { WorkedProblem } from '../../services/workedProblemsService';
import { QuestionBankQuestion } from '../../services/questionBankService';
import { cn } from '../../utils/cn';
import { SummaryMarkdown } from '../study/SummaryMarkdown';

export type CourseStudySelected =
  | { kind: 'doc'; data: Document }
  | { kind: 'video'; data: VideoListItem }
  | null;

export interface CourseArtifacts {
  notes: Note[];
  flashcards: Flashcard[];
  questions: QuestionBankQuestion[];
  glossary: GlossaryTerm[];
  workedProblems: WorkedProblem[];
}

interface CourseArtifactsWorkspaceProps {
  course: Course | null;
  documents: Document[];
  videos: VideoListItem[];
  selected: CourseStudySelected;
  setSelected: (selected: CourseStudySelected) => void;
  artifacts: CourseArtifacts;
  loading: boolean;
}

type ArtifactDetail =
  | { kind: 'summaries'; itemKey: string; type: 'summary'; title: string; content: string }
  | { kind: 'notes'; itemKey: string; type: 'note'; title: string; content: string }
  | { kind: 'flashcards'; itemKey: string; type: 'flashcard'; title: string; front: string; back: string }
  | { kind: 'questions'; itemKey: string; type: 'question'; title: string; question: QuestionBankQuestion }
  | { kind: 'glossary'; itemKey: string; type: 'glossary'; title: string; term: GlossaryTerm }
  | { kind: 'workedProblems'; itemKey: string; type: 'problem'; title: string; problem: WorkedProblem }
  | null;

type ArtifactKind = 'summaries' | 'notes' | 'flashcards' | 'questions' | 'glossary' | 'workedProblems';
type OpenArtifactDetail = Exclude<ArtifactDetail, null>;

const ARTIFACT_PAGE_SIZE = 8;

const initialSectionPages: Record<ArtifactKind, number> = {
  summaries: 1,
  notes: 1,
  flashcards: 1,
  questions: 1,
  glossary: 1,
  workedProblems: 1,
};

const stripHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const hasHtmlMarkup = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value);

const ArtifactContent: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  if (hasHtmlMarkup(value)) {
    return (
      <div
        className={cn('prose prose-sm max-w-none', className)}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <div className={cn('prose prose-sm max-w-none artifact-markdown', className)}>
      <SummaryMarkdown value={value} />
    </div>
  );
};

const getDocKind = (doc: Document): 'document' | 'article' | 'audio' =>
  doc.type === 'audio' || doc.type === 'podcast' ? 'audio' : doc.originalUrl ? 'article' : 'document';

const sourceKeyForSelected = (selected: CourseStudySelected): string | null =>
  selected ? `${selected.kind}:${selected.data.id}` : null;

const ArtifactMetric: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, value, color, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-xl border bg-white p-3 text-left transition-all hover:-translate-y-px hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30',
      active ? 'border-primary shadow-sm' : 'border-[var(--border-color)]',
    )}
  >
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums text-text-main">{value}</p>
        <p className="text-[11px] font-semibold text-text-muted">{label}</p>
      </div>
    </div>
  </button>
);

const ArtifactSection: React.FC<{
  id: ArtifactKind;
  icon: React.ElementType;
  title: string;
  count: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeArtifact: ArtifactKind | null;
  children: React.ReactNode;
}> = ({ id, icon: Icon, title, count, page, totalPages, onPageChange, activeArtifact, children }) => (
  <div
    id={`artifact-section-${id}`}
    className={cn(
      'scroll-mt-6 rounded-2xl border bg-white p-4 shadow-sm transition-all',
      activeArtifact === id ? 'border-primary shadow-md shadow-primary/10' : 'border-[var(--border-color)]',
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={16} />
        </div>
        <h3 className="font-bold text-text-main">{title}</h3>
      </div>
      <span className="rounded-full bg-[var(--bg-app)] px-2 py-0.5 text-xs font-bold text-text-muted">{count}</span>
    </div>
    <div className="mt-3 space-y-2">{children}</div>
    {totalPages > 1 && (
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-color)] pt-3">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="text-xs font-bold text-text-muted">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    )}
  </div>
);

export const CourseArtifactsWorkspace: React.FC<CourseArtifactsWorkspaceProps> = ({
  course,
  documents,
  videos,
  selected,
  setSelected,
  artifacts,
  loading,
}) => {
  const [artifactFilter, setArtifactFilter] = useState<'all' | 'current'>('all');
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKind | null>(null);
  const [detail, setDetail] = useState<ArtifactDetail>(null);
  const [sectionPages, setSectionPages] = useState<Record<ArtifactKind, number>>(initialSectionPages);
  const selectedKey = sourceKeyForSelected(selected);
  const docMap = useMemo(() => new Map(documents.map(d => [d.id, d])), [documents]);
  const videoMap = useMemo(() => new Map(videos.map(v => [v.id, v])), [videos]);

  const artifactBuckets = useMemo(() => {
    const matchesSource = (documentId?: string | null, videoId?: string | null) => {
      if (artifactFilter !== 'current' || !selected) return true;
      return selected.kind === 'doc'
        ? documentId === selected.data.id
        : videoId === selected.data.id;
    };

    return {
      notes: artifacts.notes.filter(n => matchesSource(n.documentId, n.youTubeVideoId)),
      flashcards: artifacts.flashcards.filter(f => matchesSource(f.documentId, f.youTubeVideoId)),
      questions: artifacts.questions.filter(q => matchesSource(q.documentId, q.youTubeVideoId)),
      glossary: artifacts.glossary.filter(g => matchesSource(g.documentId, g.youTubeVideoId)),
      workedProblems: artifacts.workedProblems.filter(p => matchesSource(p.documentId, p.youTubeVideoId)),
    };
  }, [artifacts, artifactFilter, selected]);

  const sourceRows = useMemo(() => [
    ...documents.map(doc => ({
      key: `doc:${doc.id}`,
      title: doc.name,
      kind: getDocKind(doc),
      selected: selected?.kind === 'doc' && selected.data.id === doc.id,
      onOpen: () => setSelected({ kind: 'doc', data: doc }),
      summary: doc.summary,
      notes: artifacts.notes.filter(n => n.documentId === doc.id).length,
      flashcards: artifacts.flashcards.filter(f => f.documentId === doc.id).length,
      questions: artifacts.questions.filter(q => q.documentId === doc.id).length,
      glossary: artifacts.glossary.filter(g => g.documentId === doc.id).length,
      workedProblems: artifacts.workedProblems.filter(p => p.documentId === doc.id).length,
    })),
    ...videos.map(video => ({
      key: `video:${video.id}`,
      title: video.title,
      kind: 'video' as const,
      selected: selected?.kind === 'video' && selected.data.id === video.id,
      onOpen: () => setSelected({ kind: 'video', data: video }),
      summary: video.summary,
      notes: artifacts.notes.filter(n => n.youTubeVideoId === video.id).length,
      flashcards: artifacts.flashcards.filter(f => f.youTubeVideoId === video.id).length,
      questions: artifacts.questions.filter(q => q.youTubeVideoId === video.id).length,
      glossary: artifacts.glossary.filter(g => g.youTubeVideoId === video.id).length,
      workedProblems: artifacts.workedProblems.filter(p => p.youTubeVideoId === video.id).length,
    })),
  ], [documents, videos, artifacts, selected, setSelected]);

  const visibleRows = artifactFilter === 'current' && selectedKey
    ? sourceRows.filter(row => row.key === selectedKey)
    : sourceRows;

  const summaryRows = useMemo(() => visibleRows.filter(row => row.summary), [visibleRows]);

  useEffect(() => {
    setSectionPages(initialSectionPages);
  }, [artifactFilter, selectedKey]);

  const recentNotes = artifacts.notes.slice(0, 6);
  const weakProblems = artifacts.workedProblems.slice(0, 6);

  const sourceTitle = (documentId?: string | null, videoId?: string | null, fallback = 'Course material') => {
    if (videoId) return videoMap.get(videoId)?.title ?? fallback;
    if (documentId) return docMap.get(documentId)?.name ?? fallback;
    return fallback;
  };

  const setSectionPage = (kind: ArtifactKind, page: number) => {
    setSectionPages(current => ({
      ...current,
      [kind]: Math.max(1, page),
    }));
  };

  const getPagedItems = <T,>(kind: ArtifactKind, items: T[]) => {
    const totalPages = Math.max(1, Math.ceil(items.length / ARTIFACT_PAGE_SIZE));
    const page = Math.min(sectionPages[kind] ?? 1, totalPages);
    const start = (page - 1) * ARTIFACT_PAGE_SIZE;
    return {
      items: items.slice(start, start + ARTIFACT_PAGE_SIZE),
      page,
      totalPages,
    };
  };

  const pagedNotes = getPagedItems('notes', artifactBuckets.notes);
  const pagedFlashcards = getPagedItems('flashcards', artifactBuckets.flashcards);
  const pagedQuestions = getPagedItems('questions', artifactBuckets.questions);
  const pagedGlossary = getPagedItems('glossary', artifactBuckets.glossary);
  const pagedWorkedProblems = getPagedItems('workedProblems', artifactBuckets.workedProblems);
  const pagedSummaries = getPagedItems('summaries', summaryRows);

  const buildNoteDetail = (note: Note): OpenArtifactDetail => ({
    kind: 'notes',
    itemKey: note.id,
    type: 'note',
    title: sourceTitle(note.documentId, note.youTubeVideoId, note.documentName ?? note.videoName ?? 'Note'),
    content: note.content,
  });

  const buildFlashcardDetail = (card: Flashcard): OpenArtifactDetail => ({
    kind: 'flashcards',
    itemKey: card.id,
    type: 'flashcard',
    title: sourceTitle(card.documentId, card.youTubeVideoId, card.documentName ?? card.videoName ?? 'Flashcard'),
    front: card.front,
    back: card.back,
  });

  const buildQuestionDetail = (question: QuestionBankQuestion): OpenArtifactDetail => ({
    kind: 'questions',
    itemKey: question.quizId,
    type: 'question',
    title: sourceTitle(question.documentId, question.youTubeVideoId, question.sourceName ?? 'Question'),
    question,
  });

  const buildGlossaryDetail = (term: GlossaryTerm): OpenArtifactDetail => ({
    kind: 'glossary',
    itemKey: term.id,
    type: 'glossary',
    title: sourceTitle(term.documentId, term.youTubeVideoId, term.sourceName ?? 'Glossary'),
    term,
  });

  const buildProblemDetail = (problem: WorkedProblem): OpenArtifactDetail => ({
    kind: 'workedProblems',
    itemKey: problem.workedProblemId,
    type: 'problem',
    title: sourceTitle(problem.documentId, problem.youTubeVideoId, problem.topic ?? 'Worked problem'),
    problem,
  });

  const buildSummaryDetail = (row: typeof summaryRows[number]): OpenArtifactDetail => ({
    kind: 'summaries',
    itemKey: row.key,
    type: 'summary',
    title: row.title,
    content: row.summary ?? '',
  });

  const getDetailList = (kind: ArtifactKind): OpenArtifactDetail[] => {
    switch (kind) {
      case 'summaries':
        return summaryRows.map(buildSummaryDetail);
      case 'notes':
        return artifactBuckets.notes.map(buildNoteDetail);
      case 'flashcards':
        return artifactBuckets.flashcards.map(buildFlashcardDetail);
      case 'questions':
        return artifactBuckets.questions.map(buildQuestionDetail);
      case 'glossary':
        return artifactBuckets.glossary.map(buildGlossaryDetail);
      case 'workedProblems':
        return artifactBuckets.workedProblems.map(buildProblemDetail);
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


  const emptyLine = <p className="text-sm text-text-muted">Nothing generated yet.</p>;

  const handleMetricClick = (kind: ArtifactKind) => {
    setActiveArtifact(kind);
    window.requestAnimationFrame(() => {
      document.getElementById(`artifact-section-${kind}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-app)]">
      <div className="mx-auto max-w-7xl space-y-5 p-4 lg:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-text-main">{course?.name ?? 'Course'} artifacts</h1>
            <p className="mt-1 text-sm text-text-muted">Summaries, notes, flashcards, quizzes, glossary terms, and worked problems in one course view.</p>
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <ArtifactMetric icon={FileText} label="Summaries" value={sourceRows.filter(r => r.summary).length} color="#0d9488" active={activeArtifact === 'summaries'} onClick={() => handleMetricClick('summaries')} />
          <ArtifactMetric icon={NotebookPen} label="Notes" value={artifacts.notes.length} color="#2563eb" active={activeArtifact === 'notes'} onClick={() => handleMetricClick('notes')} />
          <ArtifactMetric icon={BrainCircuit} label="Flashcards" value={artifacts.flashcards.length} color="#7c3aed" active={activeArtifact === 'flashcards'} onClick={() => handleMetricClick('flashcards')} />
          <ArtifactMetric icon={Award} label="Questions" value={artifacts.questions.length} color="#ea580c" active={activeArtifact === 'questions'} onClick={() => handleMetricClick('questions')} />
          <ArtifactMetric icon={BookMarked} label="Glossary" value={artifacts.glossary.length} color="#059669" active={activeArtifact === 'glossary'} onClick={() => handleMetricClick('glossary')} />
          <ArtifactMetric icon={Dumbbell} label="Problems" value={artifacts.workedProblems.length} color="#be123c" active={activeArtifact === 'workedProblems'} onClick={() => handleMetricClick('workedProblems')} />
        </div>

        {!loading && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ArtifactSection id="notes" icon={NotebookPen} title="Notes" count={artifactBuckets.notes.length} page={pagedNotes.page} totalPages={pagedNotes.totalPages} onPageChange={page => setSectionPage('notes', page)} activeArtifact={activeArtifact}>
              {artifactBuckets.notes.length === 0 ? emptyLine : pagedNotes.items.map(note => {
                const detail = buildNoteDetail(note);
                return (
                  <button
                    key={note.id}
                    onClick={() => setDetail(detail)}
                    className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5"
                  >
                    <p className="truncate text-sm font-semibold text-text-main">{detail.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">{stripHtml(note.content)}</p>
                  </button>
                );
              })}
            </ArtifactSection>

            <ArtifactSection id="flashcards" icon={BrainCircuit} title="Flashcards" count={artifactBuckets.flashcards.length} page={pagedFlashcards.page} totalPages={pagedFlashcards.totalPages} onPageChange={page => setSectionPage('flashcards', page)} activeArtifact={activeArtifact}>
              {artifactBuckets.flashcards.length === 0 ? emptyLine : pagedFlashcards.items.map(card => (
                <button
                  key={card.id}
                  onClick={() => setDetail(buildFlashcardDetail(card))}
                  className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5"
                >
                  <p className="line-clamp-2 text-sm font-semibold text-text-main">{card.front}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-text-muted">{card.back}</p>
                </button>
              ))}
            </ArtifactSection>

            <ArtifactSection id="questions" icon={Award} title="Quizzes" count={artifactBuckets.questions.length} page={pagedQuestions.page} totalPages={pagedQuestions.totalPages} onPageChange={page => setSectionPage('questions', page)} activeArtifact={activeArtifact}>
              {artifactBuckets.questions.length === 0 ? emptyLine : pagedQuestions.items.map(question => (
                <button
                  key={question.quizId}
                  onClick={() => setDetail(buildQuestionDetail(question))}
                  className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5"
                >
                  <p className="line-clamp-2 text-sm font-semibold text-text-main">{question.question}</p>
                  <p className="mt-1 text-xs text-text-muted">{question.difficulty} · {question.options.length} options</p>
                </button>
              ))}
            </ArtifactSection>

            <ArtifactSection id="glossary" icon={BookMarked} title="Glossary Terms" count={artifactBuckets.glossary.length} page={pagedGlossary.page} totalPages={pagedGlossary.totalPages} onPageChange={page => setSectionPage('glossary', page)} activeArtifact={activeArtifact}>
              {artifactBuckets.glossary.length === 0 ? emptyLine : pagedGlossary.items.map(term => (
                <button
                  key={term.id}
                  onClick={() => setDetail(buildGlossaryDetail(term))}
                  className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5"
                >
                  <p className="text-sm font-semibold text-text-main">{term.term}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{term.definition}</p>
                </button>
              ))}
            </ArtifactSection>

            <ArtifactSection id="workedProblems" icon={Dumbbell} title="Worked Problems" count={artifactBuckets.workedProblems.length} page={pagedWorkedProblems.page} totalPages={pagedWorkedProblems.totalPages} onPageChange={page => setSectionPage('workedProblems', page)} activeArtifact={activeArtifact}>
              {artifactBuckets.workedProblems.length === 0 ? emptyLine : pagedWorkedProblems.items.map(problem => (
                <button
                  key={problem.workedProblemId}
                  onClick={() => setDetail(buildProblemDetail(problem))}
                  className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5"
                >
                  <p className="line-clamp-2 text-sm font-semibold text-text-main">{problem.problemText}</p>
                  <p className="mt-1 text-xs text-text-muted">{problem.difficulty} · {problem.steps.length} steps</p>
                </button>
              ))}
            </ArtifactSection>

            <ArtifactSection id="summaries" icon={FileText} title="Summaries" count={summaryRows.length} page={pagedSummaries.page} totalPages={pagedSummaries.totalPages} onPageChange={page => setSectionPage('summaries', page)} activeArtifact={activeArtifact}>
              {summaryRows.length === 0 ? emptyLine : pagedSummaries.items.map(row => (
                <button
                  key={row.key}
                  onClick={() => setDetail(buildSummaryDetail(row))}
                  className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5"
                >
                  <p className="truncate text-sm font-semibold text-text-main">{row.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{row.summary}</p>
                </button>
              ))}
            </ArtifactSection>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-color)] bg-white p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{detail.type}</p>
                <h2 className="mt-1 text-lg font-bold text-text-main">{detail.title}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4 text-sm text-text-main">
              {detail.type === 'summary' && <ArtifactContent value={detail.content} />}
              {detail.type === 'note' && <ArtifactContent value={detail.content} />}
              {detail.type === 'flashcard' && (
                <>
                  <div className="rounded-xl bg-[var(--bg-app)] p-4">
                    <p className="text-xs font-bold text-text-muted">Front</p>
                    <ArtifactContent value={detail.front} className="mt-2" />
                  </div>
                  <div className="rounded-xl bg-primary/5 p-4">
                    <p className="text-xs font-bold text-primary">Back</p>
                    <ArtifactContent value={detail.back} className="mt-2" />
                  </div>
                </>
              )}
              {detail.type === 'question' && (
                <>
                  <ArtifactContent value={detail.question.question} />
                  <div className="space-y-2">
                    {detail.question.options.map((option, index) => (
                      <div key={index} className="rounded-xl bg-[var(--bg-app)] px-3 py-2">
                        <ArtifactContent value={option} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-bold text-primary">Answer</p>
                    <ArtifactContent value={detail.question.correctAnswer} className="mt-1" />
                  </div>
                  {detail.question.explanation && (
                    <div>
                      <p className="font-bold text-text-main">Explanation</p>
                      <ArtifactContent value={detail.question.explanation} className="mt-1 text-text-muted" />
                    </div>
                  )}
                </>
              )}
              {detail.type === 'glossary' && (
                <div>
                  <p className="text-xl font-bold">{detail.term.term}</p>
                  <ArtifactContent value={detail.term.definition} className="mt-2 text-text-muted" />
                </div>
              )}
              {detail.type === 'problem' && (
                <>
                  <ArtifactContent value={detail.problem.problemText} />
                  <div className="space-y-2">
                    {detail.problem.steps.map(step => (
                      <div key={step.stepNumber} className="rounded-xl bg-[var(--bg-app)] p-3">
                        <p className="font-semibold">Step {step.stepNumber}</p>
                        <ArtifactContent value={step.description} className="mt-1 text-text-muted" />
                        {step.formula && <ArtifactContent value={`$$${step.formula}$$`} className="mt-2 text-primary" />}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-bold text-primary">Final answer</p>
                    <ArtifactContent value={detail.problem.finalAnswer} className="mt-1" />
                  </div>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-color)] bg-white p-4">
              <button
                type="button"
                onClick={() => switchDetail(-1)}
                disabled={detailCount <= 1}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <span className="text-xs font-bold text-text-muted">
                {detailPosition} of {detailCount}
              </span>
              <button
                type="button"
                onClick={() => switchDetail(1)}
                disabled={detailCount <= 1}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

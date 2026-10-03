import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStudy } from '../../context/StudyContext';
import { documentService } from '../../services/documentService';
import { videoService, VideoListItem } from '../../services/videoService';
import { courseService } from '../../services/courseService';
import { glossaryService } from '../../services/glossaryService';
import { noteService } from '../../services/noteService';
import { workedProblemsService, WorkedProblem } from '../../services/workedProblemsService';
import { questionBankService, QuestionBankQuestion } from '../../services/questionBankService';
import { Document, Course, GlossaryTerm, Note } from '../../types';
import { CourseArtifacts, CourseStudySelected } from '../../components/course/CourseArtifactsWorkspace';
import { useStudyTimer } from '../../hooks/useStudyTimer';

export type WorkspaceMode = 'study' | 'artifacts';

/** Course, materials, artifacts and selection state behind CourseStudyPage. */
export function useCourseStudy(courseId: string | undefined) {
  const { courses, flashcards: contextFlashcards, totalNotes, ensureFlashcards } = useStudy();
  // The full flashcard deck loads lazily — pull it now this page reads it.
  useEffect(() => { void ensureFlashcards(); }, [ensureFlashcards]);
  useStudyTimer({ contextType: 'course', courseId, contextId: courseId, enabled: !!courseId });

  const [course, setCourse] = useState<Course | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<CourseStudySelected>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('study');

  // Studied tracking (persisted per course in localStorage)
  const [studiedIds, setStudiedIds] = useState<Set<string>>(new Set());
  const [filterUnstudied, setFilterUnstudied] = useState(false);

  const [artifacts, setArtifacts] = useState<CourseArtifacts>({
    notes: [],
    flashcards: [],
    questions: [],
    glossary: [],
    workedProblems: [],
  });
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);

  // Load studied IDs from localStorage when courseId changes
  useEffect(() => {
    if (!courseId) return;
    const raw = localStorage.getItem(`studied_${courseId}`);
    setStudiedIds(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
  }, [courseId]);

  const toggleStudied = useCallback((id: string) => {
    setStudiedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (courseId) localStorage.setItem(`studied_${courseId}`, JSON.stringify([...next]));
      return next;
    });
  }, [courseId]);

  // ─── Load course + materials ──────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    const ctxCourse = courses.find(c => c.id === courseId);
    if (ctxCourse) setCourse(ctxCourse);
    else courseService.getCourse(courseId).then(setCourse).catch(() => { });

    setIsLoadingMaterials(true);
    Promise.all([
      documentService.getDocuments(courseId),
      videoService.getVideos({ courseId }),
    ]).then(([docs, vids]) => {
      setDocuments(docs);
      setVideos(vids.items);
      if (docs.length > 0) setSelected({ kind: 'doc', data: docs[0] });
      else if (vids.items.length > 0) setSelected({ kind: 'video', data: vids.items[0] });
    }).catch(() => { }).finally(() => setIsLoadingMaterials(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Bulk endpoints replace the old per-material fan-out: one notes page, one
  // course-scoped question-bank query and one glossary fetch cover every
  // document and video. Worked problems have no bulk endpoint yet, so they
  // remain per-material. Flashcards come straight from StudyContext (which
  // already holds the user's full deck) — see courseFlashcards below.
  useEffect(() => {
    if (!courseId || (documents.length === 0 && videos.length === 0)) {
      setArtifacts({ notes: [], flashcards: [], questions: [], glossary: [], workedProblems: [] });
      return;
    }

    let cancelled = false;
    const loadArtifacts = async () => {
      setIsLoadingArtifacts(true);
      try {
        const [notesPage, questions, glossary, docProblems, videoProblems] = await Promise.all([
          noteService.getAllNotes(1, Math.max(totalNotes, 50)).catch(() => ({ items: [] as Note[], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 })),
          questionBankService.getQuestions({ courseId }).catch(() => [] as QuestionBankQuestion[]),
          glossaryService.getAllGlossary().catch(() => [] as GlossaryTerm[]),
          Promise.all(documents.map(doc => workedProblemsService.getProblems(doc.id).catch(() => [] as WorkedProblem[]))),
          Promise.all(videos.map(video => workedProblemsService.getVideoProblems(video.id).catch(() => [] as WorkedProblem[]))),
        ]);

        if (cancelled) return;
        const documentIds = new Set(documents.map(d => d.id));
        const videoIds = new Set(videos.map(v => v.id));
        const inCourse = (docId?: string | null, videoId?: string | null) =>
          (!!docId && documentIds.has(docId)) || (!!videoId && videoIds.has(videoId));
        setArtifacts({
          notes: notesPage.items.filter(n => inCourse(n.documentId, n.videoId)),
          flashcards: [],
          questions, // already course-scoped (and source-labeled) server-side
          glossary: glossary.filter(g =>
            inCourse(g.documentId, g.videoId) || g.courseId === courseId,
          ),
          workedProblems: [...docProblems.flat(), ...videoProblems.flat()],
        });
      } finally {
        if (!cancelled) setIsLoadingArtifacts(false);
      }
    };

    void loadArtifacts();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, documents, videos]);

  // The full flashcard deck already lives in StudyContext; filtering it locally
  // avoids one request per material and keeps cards in sync as the deferred
  // context load resolves.
  const courseFlashcards = useMemo(() => {
    const documentIds = new Set(documents.map(d => d.id));
    const videoIds = new Set(videos.map(v => v.id));
    return contextFlashcards.filter(f =>
      (!!f.documentId && documentIds.has(f.documentId)) ||
      (!!f.videoId && videoIds.has(f.videoId)));
  }, [contextFlashcards, documents, videos]);

  const artifactsWithFlashcards = useMemo(
    () => ({ ...artifacts, flashcards: courseFlashcards }),
    [artifacts, courseFlashcards],
  );

  // ─── Derived values ──────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => documents.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterUnstudied || !studiedIds.has(d.id))
  ), [documents, search, filterUnstudied, studiedIds]);

  const filteredVideos = useMemo(() => videos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) &&
    (!filterUnstudied || !studiedIds.has(v.id))
  ), [videos, search, filterUnstudied, studiedIds]);

  const accent = course?.color || 'var(--primary)';
  const itemName = selected
    ? (selected.kind === 'doc' ? selected.data.name : selected.data.title)
    : '';

  return {
    course, documents, videos, isLoadingMaterials,
    search, setSearch,
    selected, setSelected,
    workspaceMode, setWorkspaceMode,
    studiedIds, filterUnstudied, setFilterUnstudied, toggleStudied,
    artifactsWithFlashcards, isLoadingArtifacts,
    filteredDocs, filteredVideos, accent, itemName,
  };
}

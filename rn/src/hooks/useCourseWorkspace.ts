import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { flashcardService } from '@/services/flashcardService';
import { glossaryService } from '@/services/glossaryService';
import { libraryService, type LibraryEntry } from '@/services/libraryService';
import { noteService } from '@/services/noteService';
import { questionBankService } from '@/services/questionBankService';
import { Colors } from '@/constants/theme';
import type { Flashcard, GlossaryTerm, Note, QuizQuestion } from '@/types';
import {
  ARTIFACT_META,
  isArtifactKind,
  type ArtifactKind,
  type CourseArtifacts,
  type Mode,
} from '@/components/library/courseWorkspace';

/**
 * State + data loading behind the course workspace screen. The screen and its
 * two panes (materials / artifacts) are pure presentation over this view-model.
 */
export function useCourseWorkspace() {
  const { id: courseId, name, color, mode: modeParam, artifact: artifactParam } =
    useLocalSearchParams<{ id: string; name?: string; color?: string; mode?: string; artifact?: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [search, setSearch] = useState('');
  const [studiedIds, setStudiedIds] = useState<Set<string>>(new Set());
  const [artifacts, setArtifacts] = useState<CourseArtifacts | null>(null);

  // Both starting tabs are deep-linkable (`?mode=artifacts&artifact=questions`).
  // The route param seeds the tab and a tap overrides it, recording which param
  // it was made under so arriving with a *new* param supersedes a stale choice.
  // This derives the value instead of syncing route→state in an effect (which
  // would be a setState-in-effect cascading render) — same pattern as Library.
  const routeMode: Mode = modeParam === 'artifacts' ? 'artifacts' : 'materials';
  const [modeOverride, setModeOverride] = useState<{ base: Mode; value: Mode } | null>(null);
  const mode = modeOverride?.base === routeMode ? modeOverride.value : routeMode;
  const setMode = useCallback((value: Mode) => setModeOverride({ base: routeMode, value }), [routeMode]);

  const routeArtifact: ArtifactKind = isArtifactKind(artifactParam) ? artifactParam : 'notes';
  const [artifactOverride, setArtifactOverride] = useState<{ base: ArtifactKind; value: ArtifactKind } | null>(null);
  const activeArtifact = artifactOverride?.base === routeArtifact ? artifactOverride.value : routeArtifact;
  const setActiveArtifact = useCallback(
    (value: ArtifactKind) => setArtifactOverride({ base: routeArtifact, value }),
    [routeArtifact],
  );

  const accent = color || Colors.primary;

  useEffect(() => {
    if (name) navigation.setOptions({ title: name });
  }, [name, navigation]);

  useEffect(() => {
    if (!courseId) return;
    // The server clamps pageSize to 100 (anything larger falls back to 8) —
    // page through at the max so big courses still load completely.
    (async () => {
      const all: LibraryEntry[] = [];
      let pageNum = 1;
      let totalPages = 1;
      do {
        const result = await libraryService.getLibrary({ courseId, page: pageNum, pageSize: 100 });
        all.push(...result.items);
        totalPages = result.totalPages;
        pageNum += 1;
      } while (pageNum <= totalPages);
      setEntries(all);
    })().catch(() => setEntries([]));
    AsyncStorage.getItem(`studied_${courseId}`)
      .then((raw) => { if (raw) setStudiedIds(new Set(JSON.parse(raw) as string[])); })
      .catch(() => {});
  }, [courseId]);

  const toggleStudied = useCallback((id: string) => {
    setStudiedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void AsyncStorage.setItem(`studied_${courseId}`, JSON.stringify([...next]));
      return next;
    });
  }, [courseId]);

  // Artifacts load lazily on first switch to the tab. Questions are course-scoped
  // server-side; notes/flashcards/glossary are filtered against the course's
  // material ids client-side — the same aggregation rules as web.
  useEffect(() => {
    if (mode !== 'artifacts' || artifacts !== null || entries === null) return;
    const documentIds = new Set(entries.filter((e) => e.kind === 'document').map((e) => e.data.id));
    const videoIds = new Set(entries.filter((e) => e.kind === 'video').map((e) => e.data.id));
    const inCourse = (docId?: string | null, videoId?: string | null) =>
      (!!docId && documentIds.has(docId)) || (!!videoId && videoIds.has(videoId));

    Promise.all([
      noteService.list(1, 100).then((p) => p.items).catch(() => [] as Note[]),
      flashcardService.list().then((p) => p.items).catch(() => [] as Flashcard[]),
      questionBankService.list({ courseId }).catch(() => [] as QuizQuestion[]),
      glossaryService.list().catch(() => [] as GlossaryTerm[]),
    ]).then(([notes, cards, questions, glossary]) => {
      setArtifacts({
        notes: notes.filter((n) => inCourse(n.documentId, n.videoId)),
        flashcards: cards.filter((c) => inCourse(c.documentId, c.videoId)),
        questions,
        glossary: glossary.filter((g) => inCourse(g.documentId, g.videoId) || g.courseId === courseId),
      });
    });
  }, [mode, artifacts, entries, courseId]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!entries) return [];
    if (!q) return entries;
    return entries.filter((e) =>
      (e.kind === 'document' ? e.data.name : e.data.title).toLowerCase().includes(q));
  }, [entries, search]);

  const openEntry = useCallback((entry: LibraryEntry) => {
    if (entry.kind === 'document') router.push(`/(tabs)/library/document/${entry.data.id}?courseId=${entry.data.courseId}`);
    else router.push(`/(tabs)/library/video/${entry.data.id}`);
  }, [router]);

  const docCount = entries?.filter((e) => e.kind === 'document').length ?? 0;
  const videoCount = (entries?.length ?? 0) - docCount;

  return {
    name, accent, mode, setMode, entries, search, setSearch,
    studiedIds, toggleStudied, artifacts, activeArtifact, setActiveArtifact,
    filteredEntries, openEntry, docCount, videoCount,
  };
}

export { ARTIFACT_META };

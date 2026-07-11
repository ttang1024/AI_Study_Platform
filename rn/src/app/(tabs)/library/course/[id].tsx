import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookMarked, BookOpen, BrainCircuit, CheckCircle2, Circle, HelpCircle, NotebookPen } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SearchBar } from '@/components/SearchBar';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { LibraryEntryRow } from '@/components/library/LibraryEntryRow';
import { AnswerableQuestionRow } from '@/components/quiz/AnswerableQuestionRow';
import { Alpha, Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { flashcardService } from '@/services/flashcardService';
import { glossaryService } from '@/services/glossaryService';
import { libraryService, type LibraryEntry } from '@/services/libraryService';
import { noteService } from '@/services/noteService';
import { questionBankService } from '@/services/questionBankService';
import type { Flashcard, GlossaryTerm, Note, QuizQuestion } from '@/types';
import { cardBackText, cardFrontText } from '@/utils/flashcardDisplay';
import { stripHtml } from '@/utils/stripHtml';

type Mode = 'materials' | 'artifacts';
type ArtifactKind = 'notes' | 'flashcards' | 'questions' | 'glossary';

interface CourseArtifacts {
  notes: Note[];
  flashcards: Flashcard[];
  questions: QuizQuestion[];
  glossary: GlossaryTerm[];
}

// Fixed pixel height (see FilterChip's CHIP_HEIGHT note): the chip row's
// horizontal ScrollView needs an exact matching height, and flexShrink 0,
// or a long FlatList below compresses the row and clips the labels.
const METRIC_CHIP_HEIGHT = 32;

const ARTIFACT_META: { kind: ArtifactKind; label: string; icon: LucideIcon; color: string }[] = [
  { kind: 'notes', label: 'Notes', icon: NotebookPen, color: Colors.blue },
  { kind: 'flashcards', label: 'Cards', icon: BrainCircuit, color: Colors.teal },
  { kind: 'questions', label: 'Questions', icon: HelpCircle, color: Colors.amber },
  { kind: 'glossary', label: 'Glossary', icon: BookMarked, color: Colors.purple },
];

/**
 * Mobile port of web's CourseStudyPage. The web page is a three-pane desktop
 * workspace (materials sidebar + embedded detail + artifacts view); on a phone
 * the same jobs split into two tabs — Materials (list, studied check-offs,
 * push-navigation instead of an embedded pane) and Artifacts (course-wide
 * aggregation of notes/flashcards/questions/glossary, same filtering rules).
 */
export default function CourseWorkspaceScreen() {
  const { id: courseId, name, color, mode: modeParam, artifact: artifactParam } =
    useLocalSearchParams<{ id: string; name?: string; color?: string; mode?: string; artifact?: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  // Same convention as the Library screen's `type` param: the starting tabs
  // are deep-linkable (`?mode=artifacts&artifact=questions`).
  const [mode, setMode] = useState<Mode>(modeParam === 'artifacts' ? 'artifacts' : 'materials');
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [search, setSearch] = useState('');
  const [studiedIds, setStudiedIds] = useState<Set<string>>(new Set());
  const [artifacts, setArtifacts] = useState<CourseArtifacts | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKind>(
    ARTIFACT_META.some((m) => m.kind === artifactParam) ? (artifactParam as ArtifactKind) : 'notes',
  );

  const accent = color || Colors.primary;

  useEffect(() => {
    if (name) navigation.setOptions({ title: name });
  }, [name, navigation]);

  // On cold-launch deep links the params can arrive after first mount, so
  // follow them with effects too (same pattern as the Library screen's `type`).
  useEffect(() => {
    if (modeParam === 'artifacts' || modeParam === 'materials') setMode(modeParam);
  }, [modeParam]);

  useEffect(() => {
    if (ARTIFACT_META.some((m) => m.kind === artifactParam)) setActiveArtifact(artifactParam as ArtifactKind);
  }, [artifactParam]);

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

  if (entries === null) return <LoadingScreen />;

  const docCount = entries.filter((e) => e.kind === 'document').length;
  const videoCount = entries.length - docCount;

  return (
    <View style={styles.root}>
      <View style={[styles.courseBanner, { borderLeftColor: accent }]}>
        <Text style={styles.courseName} numberOfLines={1}>{name ?? 'Course'}</Text>
        <Text style={styles.courseCounts}>
          {docCount} doc{docCount === 1 ? '' : 's'} · {videoCount} video{videoCount === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedTabs<Mode>
          options={[{ value: 'materials', label: 'Materials' }, { value: 'artifacts', label: 'Artifacts' }]}
          value={mode}
          onChange={setMode}
        />
      </View>

      {mode === 'materials' ? (
        <>
          <View style={styles.searchWrap}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search materials…" />
          </View>
          {filteredEntries.length === 0 ? (
            <EmptyState icon={BookOpen} title="No materials" subtitle="Add documents or videos to this course on the web." />
          ) : (
            <FlatList
              data={filteredEntries}
              keyExtractor={(e) => `${e.kind}-${e.data.id}`}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const studied = studiedIds.has(item.data.id);
                return (
                  <View style={[styles.materialRow, studied && styles.materialRowStudied]}>
                    <View style={styles.materialRowEntry}>
                      <LibraryEntryRow entry={item} onPress={openEntry} />
                    </View>
                    <Pressable
                      onPress={() => toggleStudied(item.data.id)}
                      hitSlop={8}
                      accessibilityLabel={studied ? 'Mark as unread' : 'Mark as studied'}
                    >
                      {studied
                        ? <CheckCircle2 size={20} color={Colors.emerald} />
                        : <Circle size={20} color={Colors.textSecondary} />}
                    </Pressable>
                  </View>
                );
              }}
            />
          )}
        </>
      ) : (
        <ArtifactsPane artifacts={artifacts} active={activeArtifact} onChangeActive={setActiveArtifact} />
      )}
    </View>
  );
}

const ArtifactsPane: React.FC<{
  artifacts: CourseArtifacts | null;
  active: ArtifactKind;
  onChangeActive: (kind: ArtifactKind) => void;
}> = ({ artifacts, active, onChangeActive }) => {
  // Question answering state lives here (not in the rows) so it survives
  // FlatList virtualization unmounting offscreen rows.
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  const toggleQuestion = useCallback((id: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const answerQuestion = useCallback((id: string, option: string | null) => {
    setQuestionAnswers((prev) => {
      const next = { ...prev };
      if (option === null) delete next[id];
      else next[id] = option;
      return next;
    });
    // Feed the mistake notebook: wrong picks create/bump an entry, correct ones
    // resolve it. Grading stays local, so a network failure only loses tracking.
    if (option !== null) questionBankService.recordAttempt(id, option).catch(() => {});
  }, []);

  if (!artifacts) return <LoadingScreen />;

  const counts: Record<ArtifactKind, number> = {
    notes: artifacts.notes.length,
    flashcards: artifacts.flashcards.length,
    questions: artifacts.questions.length,
    glossary: artifacts.glossary.length,
  };

  // Questions get their own answerable rows below; the generic title/body
  // cards cover the read-only kinds.
  const rows: { key: string; title: string; body: string }[] = (() => {
    switch (active) {
      case 'notes':
        return artifacts.notes.map((n) => ({
          key: n.id, title: n.documentName ?? n.videoName ?? 'Note', body: stripHtml(n.content),
        }));
      case 'flashcards':
        return artifacts.flashcards.map((c) => ({
          key: c.id, title: cardFrontText(c), body: cardBackText(c),
        }));
      case 'questions':
        return [];
      case 'glossary':
        return artifacts.glossary.map((g) => ({
          key: g.id, title: g.term, body: g.definition,
        }));
    }
  })();

  return (
    <View style={styles.artifactsRoot}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricScroll} contentContainerStyle={styles.metricRow}>
        {ARTIFACT_META.map(({ kind, label, icon: Icon, color }) => {
          const isActive = active === kind;
          return (
            <Pressable
              key={kind}
              style={[styles.metricChip, isActive && { borderColor: color, backgroundColor: `${color}${Alpha.tint}` }]}
              onPress={() => onChangeActive(kind)}
            >
              <Icon size={14} color={isActive ? color : Colors.textSecondary} />
              <Text style={[styles.metricLabel, isActive && { color }]}>{label}</Text>
              <Text style={[styles.metricCount, isActive && { color }]}>{counts[kind]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {active === 'questions' ? (
        artifacts.questions.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nothing here yet" subtitle="Generate study artifacts from this course's materials." />
        ) : (
          <FlatList
            data={artifacts.questions}
            keyExtractor={(q) => q.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <AnswerableQuestionRow
                question={item}
                expanded={expandedQuestionIds.has(item.id)}
                answer={questionAnswers[item.id]}
                onToggleExpand={toggleQuestion}
                onAnswer={answerQuestion}
              />
            )}
          />
        )
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nothing here yet" subtitle="Generate study artifacts from this course's materials." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.artifactCard}>
              <Text style={styles.artifactTitle} numberOfLines={2}>{item.title}</Text>
              {!!item.body && <Text style={styles.artifactBody} numberOfLines={4}>{item.body}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  courseBanner: {
    marginHorizontal: Spacing.three, marginTop: Spacing.three, padding: Spacing.three,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderLeftWidth: 4, ...Shadows.card,
  },
  courseName: { ...Typography.bodyBold, color: Colors.textPrimary },
  courseCounts: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  tabsWrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  searchWrap: { padding: Spacing.three, paddingBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  materialRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  materialRowStudied: { opacity: 0.55 },
  materialRowEntry: { flex: 1 },
  artifactsRoot: { flex: 1 },
  metricScroll: { flexGrow: 0, flexShrink: 0, height: METRIC_CHIP_HEIGHT + Spacing.three + Spacing.two },
  metricRow: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, paddingBottom: Spacing.two },
  metricChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: METRIC_CHIP_HEIGHT,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill,
    paddingHorizontal: 12, backgroundColor: Colors.bgCard,
  },
  metricLabel: { ...Typography.captionBold, lineHeight: 16, color: Colors.textSecondary },
  metricCount: { ...Typography.captionBold, lineHeight: 16, color: Colors.textSecondary },
  artifactCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three,
    gap: 4, ...Shadows.card,
  },
  artifactTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  artifactBody: { ...Typography.caption, color: Colors.textSecondary },
});

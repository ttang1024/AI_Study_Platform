import { useState, useEffect } from 'react';
import { useStudy } from '../context/StudyContext';
import { glossaryService } from '../services/glossaryService';
import { documentService } from '../services/documentService';
import { videoService } from '../services/videoService';
import {
  downloadNotesMarkdown,
  downloadObsidianVault,
  downloadQtiZip,
  downloadQuizCsv,
  downloadStudyPackPdf,
  ExportGlossaryRecord,
  ExportNoteRecord,
  ExportQuizRecord,
  StudyPackExport,
} from '../services/exportInteropService';
import { getCorrectQuizOptionText } from '../utils/quizAnswers';

export type ExportKind = 'notes' | 'pdf' | 'obsidian' | 'quizCsv' | 'qti';

/** Owns the Settings → Export tab logic: builds export payloads from study data and triggers downloads. */
export function useSettingsExport() {
  const { allNotes, documents, courses, flashcards, quizSubmissions, ensureDocuments, ensureFlashcards, ensureNotes, ensureQuizSubmissions } = useStudy();
  const [exporting, setExporting] = useState<null | ExportKind>(null);

  // The document list, flashcard deck, notes and quiz submissions load lazily; make
  // sure they're present before the user exports (exports read them straight from
  // context state).
  useEffect(() => {
    void ensureDocuments();
    void ensureFlashcards();
    void ensureNotes();
    void ensureQuizSubmissions();
  }, [ensureDocuments, ensureFlashcards, ensureNotes, ensureQuizSubmissions]);

  const buildNotesExport = (): ExportNoteRecord[] => allNotes.map(note => {
    const doc = documents.find(d => d.id === note.documentId);
    const course = courses.find(c => c.id === doc?.courseId);
    return {
      title: note.videoName ?? note.documentName ?? doc?.name ?? 'Untitled note',
      courseName: course?.name,
      sourceType: note.videoId ? 'video' : doc?.originalUrl ? 'article' : doc?.type ?? 'document',
      createdAt: note.createdAt,
      html: note.content,
    };
  });

  const buildQuizExport = async (): Promise<ExportQuizRecord[]> => {
    const records: ExportQuizRecord[] = [];
    const seen = new Set<string>();
    for (const submission of quizSubmissions) {
      const key = submission.videoId ? `video:${submission.videoId}` : `doc:${submission.documentId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        if (submission.videoId || submission.sourceType === 'video') {
          const videoId = submission.videoId ?? '';
          if (!videoId) continue;
          const questions = await videoService.getQuiz(videoId);
          records.push({
            title: submission.videoName ?? 'Video quiz',
            questions: questions.map(q => ({
              question: q.question,
              options: q.options ?? [],
              correctAnswer: getCorrectQuizOptionText(q.options, q.correctAnswer),
              explanation: q.explanation ?? '',
            })),
          });
        } else {
          const doc = documents.find(d => d.id === submission.documentId);
          if (!doc) continue;
          const course = courses.find(c => c.id === doc.courseId);
          const questions = await documentService.getQuiz(doc.courseId ?? '', doc.id);
          records.push({
            title: doc.name,
            courseName: course?.name,
            questions: questions.map(q => ({
              question: q.question,
              options: q.options ?? [],
              correctAnswer: getCorrectQuizOptionText(q.options, q.correctAnswer),
              explanation: q.explanation ?? '',
            })),
          });
        }
      } catch {
        // Continue exporting available sources.
      }
    }
    return records.filter(r => r.questions.length > 0);
  };

  const buildStudyPack = async (): Promise<StudyPackExport> => {
    const glossary = await glossaryService.getAllGlossary().catch(() => []);
    const quizRecords = await buildQuizExport();
    const glossaryRecords: ExportGlossaryRecord[] = glossary.map(term => ({
      term: term.term,
      definition: term.definition,
      sourceName: term.sourceName,
    }));
    return {
      notes: buildNotesExport(),
      quizzes: quizRecords,
      flashcards: flashcards.map(card => ({
        front: card.front,
        back: card.back,
        sourceTitle: card.documentName ?? card.videoName,
      })),
      glossary: glossaryRecords,
    };
  };

  const handleExport = async (kind: 'notes' | 'pdf' | 'obsidian' | 'quizCsv' | 'qti') => {
    setExporting(kind);
    try {
      if (kind === 'notes') {
        downloadNotesMarkdown(buildNotesExport(), 'study_platform_notes');
        return;
      }

      if (kind === 'quizCsv') {
        downloadQuizCsv(await buildQuizExport(), 'study_platform_quizzes');
        return;
      }

      if (kind === 'qti') {
        await downloadQtiZip(await buildQuizExport(), 'study_platform_quizzes');
        return;
      }

      const pack = await buildStudyPack();
      if (kind === 'pdf') await downloadStudyPackPdf(pack, 'study_platform_study_pack');
      else await downloadObsidianVault(pack, 'study_platform_vault');
    } finally {
      setExporting(null);
    }
  };

  return { exporting, handleExport };
}

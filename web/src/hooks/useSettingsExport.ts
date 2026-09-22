import { useState, useEffect } from 'react';
import { useStudy } from '../context/StudyContext';
import { documentService } from '../services/documentService';
import { videoService } from '../services/videoService';
import {
  downloadNotesMarkdown,
  downloadQtiZip,
  downloadQuizCsv,
  ExportNoteRecord,
  ExportQuizRecord,
} from '../services/exportInteropService';
import { getCorrectQuizOptionText } from '@core/utils/quizAnswers';

export type ExportKind = 'notes' | 'quizCsv' | 'qti';

/** Owns the Settings → Export tab logic: builds export payloads from study data and triggers downloads. */
export function useSettingsExport() {
  const { allNotes, documents, courses, quizSubmissions, ensureDocuments, ensureNotes, ensureQuizSubmissions } = useStudy();
  const [exporting, setExporting] = useState<null | ExportKind>(null);

  // The document list, notes and quiz submissions load lazily; make
  // sure they're present before the user exports (exports read them straight from
  // context state).
  useEffect(() => {
    void ensureDocuments();
    void ensureNotes();
    void ensureQuizSubmissions();
  }, [ensureDocuments, ensureNotes, ensureQuizSubmissions]);

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

  const handleExport = async (kind: ExportKind) => {
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

      await downloadQtiZip(await buildQuizExport(), 'study_platform_quizzes');
    } finally {
      setExporting(null);
    }
  };

  return { exporting, handleExport };
}

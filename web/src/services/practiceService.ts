import { apiClient } from './apiClient';

export type PracticeSource = 'quiz' | 'flashcard' | 'glossary' | 'problem';

export interface PracticeQuestion {
  id: string;
  source: PracticeSource;
  sourceId: string;
  format: 'mc' | 'recall';
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
  difficulty: string;
  courseId: string | null;
}

export interface PracticeTest {
  questions: PracticeQuestion[];
  count: number;
  generatedAt: string;
}

export interface PracticeResultItem {
  source: PracticeSource;
  sourceId: string;
  isCorrect: boolean;
}

export interface PracticeTestSummary {
  total: number;
  correct: number;
  accuracyPercent: number;
}

export interface GenerateOptions {
  count?: number;
  courseId?: string | null;
  sources?: PracticeSource[];
}

export const practiceService = {
  async generate(opts: GenerateOptions = {}): Promise<PracticeTest> {
    const params = new URLSearchParams();
    if (opts.count) params.set('count', String(opts.count));
    if (opts.courseId) params.set('courseId', opts.courseId);
    if (opts.sources?.length) params.set('sources', opts.sources.join(','));
    const response = await apiClient.get(`/api/practice/generate?${params.toString()}`);
    return response.data.data;
  },

  async submit(results: PracticeResultItem[]): Promise<PracticeTestSummary> {
    const response = await apiClient.post('/api/practice/submit', { results });
    return response.data.data;
  },
};

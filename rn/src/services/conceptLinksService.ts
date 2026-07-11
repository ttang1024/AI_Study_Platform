import { apiClient } from '@/services/apiClient';

export type ConceptNodeType = 'concept' | 'document' | 'video' | 'article' | 'audio' | 'podcast' | 'note' | 'quiz' | 'flashcard';

export interface ConceptNode {
  id: string;
  type: ConceptNodeType;
  title: string;
  subtitle?: string;
  url?: string;
  weight: number;
  description?: string;
  courseId?: string;
}

export interface ConceptEdge {
  source: string;
  target: string;
  label?: string;
  weight: number;
}

export interface KnowledgeGraphStats {
  materials: number;
  concepts: number;
  notes: number;
  quizzes: number;
  links: number;
}

export interface KnowledgeGraph {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  stats: KnowledgeGraphStats;
}

export interface ConceptGap {
  id: string;
  concept: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  referenceCount: number;
  defined: boolean;
  mastered: boolean;
  courseIds: string[];
  url?: string;
}

export interface KnowledgeGapStats {
  totalConcepts: number;
  gaps: number;
  unmastered: number;
  undefined: number;
  crossCourse: number;
}

export interface KnowledgeGaps {
  gaps: ConceptGap[];
  stats: KnowledgeGapStats;
}

export interface LearningPathStep {
  order: number;
  termId: string;
  concept: string;
  status: 'next' | 'ready' | 'blocked' | 'mastered';
  reason: string;
  prerequisiteDepth: number;
  prerequisites: string[];
  url?: string;
}

export interface LearningPath {
  steps: LearningPathStep[];
  masteredCount: number;
  totalCount: number;
}

export const conceptLinksService = {
  async getKnowledgeGraph(): Promise<KnowledgeGraph> {
    const res = await apiClient.get<{ data: KnowledgeGraph }>('/api/concept-links/knowledge-graph');
    return res.data.data;
  },

  async getKnowledgeGaps(): Promise<KnowledgeGaps> {
    const res = await apiClient.get<{ data: KnowledgeGaps }>('/api/concept-links/gaps');
    return res.data.data;
  },

  async getLearningPath(): Promise<LearningPath> {
    const res = await apiClient.get<{ data: LearningPath }>('/api/concept-links/learning-path');
    return res.data.data;
  },
};

import type { HttpClient } from '../http';
import { stripHtmlInline } from '../utils/stripHtml';

/**
 * The `/api/concept-links/*` reads behind the knowledge graph, knowledge gaps,
 * and learning path. web/ called this knowledgeGraphService and rn/ called it
 * conceptLinksService; the endpoints, the DTOs, and the (nullable) field shapes
 * were the same in both, so they are single-sourced here under the endpoint's
 * own name.
 */
export type ConceptNodeType =
  | 'concept' | 'document' | 'video' | 'article' | 'audio' | 'podcast' | 'note' | 'quiz' | 'flashcard';

export interface KnowledgeGraphNode {
  id: string;
  /** Widened: the server may add node kinds ahead of a client release. */
  type: ConceptNodeType | string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  weight: number;
  description?: string | null;
  courseId?: string | null;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  label?: string | null;
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
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  stats: KnowledgeGraphStats;
}

export type GapSeverity = 'high' | 'medium' | 'low';

export interface ConceptGap {
  id: string;
  concept: string;
  reason: string;
  severity: GapSeverity;
  referenceCount: number;
  defined: boolean;
  mastered: boolean;
  courseIds: string[];
  url?: string | null;
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
  url?: string | null;
}

export interface LearningPath {
  steps: LearningPathStep[];
  masteredCount: number;
  totalCount: number;
}

export function createConceptLinksService(http: HttpClient) {
  return {
    async getKnowledgeGraph(): Promise<KnowledgeGraph> {
      const res = await http.get<{ data: KnowledgeGraph }>('/api/concept-links/knowledge-graph');
      const data = res.data.data;
      // Note-derived nodes carry the note's HTML title; graph labels are plain text.
      return { ...data, nodes: data.nodes.map((n) => ({ ...n, title: stripHtmlInline(n.title) })) };
    },

    async getKnowledgeGaps(): Promise<KnowledgeGaps> {
      const res = await http.get<{ data: KnowledgeGaps }>('/api/concept-links/gaps');
      return res.data.data;
    },

    async getLearningPath(): Promise<LearningPath> {
      const res = await http.get<{ data: LearningPath }>('/api/concept-links/learning-path');
      return res.data.data;
    },
  };
}

export type ConceptLinksService = ReturnType<typeof createConceptLinksService>;

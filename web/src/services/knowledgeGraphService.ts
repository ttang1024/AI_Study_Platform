import { apiClient } from './apiClient';

export interface KnowledgeGraphNode {
  id: string;
  type: 'concept' | 'document' | 'video' | 'article' | 'audio' | 'podcast' | 'note' | 'quiz' | 'flashcard' | string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  weight: number;
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

export const knowledgeGraphService = {
  async getKnowledgeGraph(): Promise<KnowledgeGraph> {
    const response = await apiClient.get('/api/concept-links/knowledge-graph');
    return response.data.data as KnowledgeGraph;
  },
};

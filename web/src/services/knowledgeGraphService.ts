import { apiClient } from './apiClient';

export interface KnowledgeGraphNode {
  id: string;
  type: 'concept' | 'document' | 'video' | 'article' | 'audio' | 'podcast' | 'note' | 'quiz' | 'flashcard' | string;
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

const stripHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
};

export const knowledgeGraphService = {
  async getKnowledgeGraph(): Promise<KnowledgeGraph> {
    const response = await apiClient.get('/api/concept-links/knowledge-graph');
    const data = response.data.data as KnowledgeGraph;
    data.nodes = data.nodes.map(n => ({ ...n, title: stripHtml(n.title) }));
    return data;
  },
};

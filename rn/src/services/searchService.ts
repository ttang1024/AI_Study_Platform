import { apiClient } from '@/services/apiClient';

export type SearchResultType = 'document' | 'note' | 'flashcard' | 'glossary';
export type CitationType = SearchResultType | 'video';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  url: string | null;
}

export interface SearchResults {
  items: SearchResultItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface LibraryCitation {
  index: number;
  type: CitationType;
  id: string;
  title: string;
  url: string | null;
}

export interface AskLibraryAnswer {
  answer: string;
  citations: LibraryCitation[];
}

export const searchService = {
  async search(query: string, types?: SearchResultType[], page = 1, pageSize = 20): Promise<SearchResults> {
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
    types?.forEach((t) => params.append('types', t));
    const res = await apiClient.get<{ data: SearchResults }>(`/api/search?${params}`);
    return res.data.data;
  },

  async askLibrary(question: string): Promise<AskLibraryAnswer> {
    const res = await apiClient.post<{ data: AskLibraryAnswer }>('/api/search/ask', { question });
    return res.data.data;
  },
};

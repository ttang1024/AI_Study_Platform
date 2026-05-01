import { apiClient } from './apiClient';

export interface SearchResultItem {
  id: string;
  type: 'document' | 'note' | 'flashcard' | 'glossary';
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

export const searchService = {
  async search(
    query: string,
    types?: string[],
    page = 1,
    pageSize = 20
  ): Promise<SearchResults> {
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
    if (types && types.length > 0) {
      types.forEach(t => params.append('types', t));
    }
    const res = await apiClient.get<{ data: SearchResults }>(`/api/search?${params}`);
    return res.data.data;
  },
};

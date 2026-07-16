import type { HttpClient } from '../http';

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
  url?: string | null;
}

export interface AskLibraryAnswer {
  answer: string;
  citations: LibraryCitation[];
}

export function createSearchService(http: HttpClient) {
  return {
    // `types` stays string[] — web builds it from a raw URL param.
    async search(query: string, types?: string[], page = 1, pageSize = 20): Promise<SearchResults> {
      const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
      types?.forEach((t) => params.append('types', t));
      const res = await http.get<{ data: SearchResults }>(`/api/search?${params}`);
      return res.data.data;
    },

    async askLibrary(question: string): Promise<AskLibraryAnswer> {
      const res = await http.post<{ data: AskLibraryAnswer }>('/api/search/ask', { question });
      return res.data.data;
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;

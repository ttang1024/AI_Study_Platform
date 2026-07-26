import type { HttpClient } from '../http';
import type { GlossaryTerm, SourceCitation } from '../types';
import { normalizeCitation } from '../types';

/**
 * Optional offline tier for `getAllGlossary` (web injects its idb-backed
 * offlineCacheService; rn currently injects nothing, so errors propagate to the
 * caller exactly as before the extraction).
 */
export interface GlossaryOfflineCache {
  cacheGlossary(terms: GlossaryTerm[]): unknown;
  getCachedGlossary(): GlossaryTerm[] | Promise<GlossaryTerm[]>;
}

interface BackendTerm {
  id: string;
  term: string;
  definition: string;
  documentId?: string;
  videoId?: string;
  courseId?: string;
  sourceName?: string;
  sourceKind?: GlossaryTerm['sourceKind'];
  citation?: SourceCitation;
}

export function createGlossaryService(http: HttpClient, offlineCache?: GlossaryOfflineCache) {
  return {
    async getAllGlossary(): Promise<GlossaryTerm[]> {
      try {
        const res = await http.get<{ data: BackendTerm[] }>('/api/glossary');
        const terms = (res.data.data ?? []).map((t): GlossaryTerm => ({
          id: t.id,
          term: t.term,
          definition: t.definition,
          documentId: t.documentId,
          videoId: t.videoId,
          courseId: t.courseId,
          sourceName: t.sourceName,
          sourceKind: t.sourceKind,
          citation: normalizeCitation(t.citation),
        }));
        if (terms.length > 0 && offlineCache) void offlineCache.cacheGlossary(terms);
        return terms;
      } catch (e) {
        // Offline or server error — serve the last cached glossary if we have one.
        if (offlineCache) return offlineCache.getCachedGlossary();
        throw e;
      }
    },

    async getGlossary(courseId: string, documentId: string): Promise<GlossaryTerm[]> {
      try {
        const res = await http.get<{ data: BackendTerm[] }>(
          `/api/courses/${courseId}/documents/${documentId}/glossary`,
        );
        return (res.data.data ?? []).map((t): GlossaryTerm => ({
          id: t.id,
          term: t.term,
          definition: t.definition,
          documentId: t.documentId,
        }));
      } catch {
        return [];
      }
    },

    async generateGlossary(courseId: string, documentId: string): Promise<GlossaryTerm[]> {
      try {
        const res = await http.post<{ data: BackendTerm[] }>(
          `/api/courses/${courseId}/documents/${documentId}/glossary/generate`,
          {},
        );
        return (res.data.data ?? []).map((t): GlossaryTerm => ({
          id: t.id,
          term: t.term,
          definition: t.definition,
          documentId: t.documentId,
        }));
      } catch {
        return [];
      }
    },

    async getVideoGlossary(videoId: string): Promise<GlossaryTerm[]> {
      try {
        const res = await http.get<{ data: BackendTerm[] }>(`/api/videos/${videoId}/glossary`);
        return (res.data.data ?? []).map((t): GlossaryTerm => ({
          id: t.id,
          term: t.term,
          definition: t.definition,
          videoId: videoId,
        }));
      } catch {
        return [];
      }
    },

    async generateVideoGlossary(videoId: string, videoUrl: string): Promise<GlossaryTerm[]> {
      const res = await http.post<{ data: BackendTerm[] }>(`/api/videos/${videoId}/glossary/generate`, {
        videoUrl,
      });
      return (res.data.data ?? []).map((t): GlossaryTerm => ({
        id: t.id,
        term: t.term,
        definition: t.definition,
        videoId: videoId,
      }));
    },

    async updateTerm(termId: string, term: string, definition: string): Promise<GlossaryTerm> {
      const res = await http.put<{ data: BackendTerm }>(`/api/glossary/terms/${termId}`, {
        term,
        definition,
      });
      const t = res.data.data;
      return {
        id: t.id,
        term: t.term,
        definition: t.definition,
        documentId: t.documentId,
        videoId: t.videoId,
      };
    },

    async deleteTerm(termId: string): Promise<void> {
      await http.delete(`/api/glossary/terms/${termId}`);
    },

    /** IDs of terms the user marked mastered (web wraps this in masteredService's local cache). */
    async getMasteredIds(): Promise<string[]> {
      const res = await http.get<{ data: string[] }>('/api/glossary/mastered');
      return res.data.data ?? [];
    },

    /** Toggle mastery on the server and return the new mastered state. */
    async toggleMastered(termId: string): Promise<boolean> {
      const res = await http.post<{ data: boolean }>(`/api/glossary/mastered/${termId}`);
      return res.data.data;
    },
  };
}

export type GlossaryService = ReturnType<typeof createGlossaryService>;

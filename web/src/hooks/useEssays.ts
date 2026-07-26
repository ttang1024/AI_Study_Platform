import { useCallback, useEffect, useState } from 'react';
import essayService, { type EssaySubmission, type Rubric } from '../services/essayService';
import { getApiErrorMessage } from '../utils/apiError';

/**
 * Data and mutations for the essay workspace.
 *
 * A graded draft is never edited in place. Saving changes to one creates a revision, so the earlier
 * marks stay readable next to the new ones — that comparison is the whole point of the feature.
 */
export function useEssays() {
  const [essays, setEssays] = useState<EssaySubmission[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [chain, setChain] = useState<EssaySubmission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [e, r] = await Promise.allSettled([essayService.getEssays(), essayService.getRubrics()]);
    if (e.status === 'fulfilled') setEssays(e.value.data?.data ?? []);
    if (r.status === 'fulfilled') setRubrics(r.value.data?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEssay = useCallback(async (submissionId: string) => {
    setSelectedId(submissionId);
    setError('');
    try {
      const res = await essayService.getRevisions(submissionId);
      setChain(res.data?.data ?? []);
    } catch {
      setChain([]);
    }
  }, []);

  const closeEssay = useCallback(() => {
    setSelectedId(null);
    setChain([]);
  }, []);

  const saveDraft = useCallback(
    async (draft: {
      rubricId?: string;
      parentSubmissionId?: string;
      title: string;
      promptText?: string;
      text: string;
    }) => {
      setError('');
      try {
        const res = await essayService.saveEssay(draft);
        const saved = res.data?.data;
        await load();
        if (saved) await openEssay(saved.essaySubmissionId);
        return saved ?? null;
      } catch (e) {
        setError(getApiErrorMessage(e, 'Could not save that draft.'));
        return null;
      }
    },
    [load, openEssay],
  );

  const grade = useCallback(
    async (submissionId: string) => {
      setGrading(true);
      setError('');
      try {
        await essayService.grade(submissionId);
        await openEssay(selectedId ?? submissionId);
        await load();
      } catch (e) {
        setError(getApiErrorMessage(e, 'Could not mark that draft.'));
      } finally {
        setGrading(false);
      }
    },
    [load, openEssay, selectedId],
  );

  const saveRubric = useCallback(
    async (rubric: Parameters<typeof essayService.saveRubric>[0]) => {
      setError('');
      try {
        await essayService.saveRubric(rubric);
        await load();
        return true;
      } catch (e) {
        setError(getApiErrorMessage(e, 'Could not save that rubric.'));
        return false;
      }
    },
    [load],
  );

  const deleteRubric = useCallback(
    async (rubricId: string) => {
      await essayService.deleteRubric(rubricId);
      await load();
    },
    [load],
  );

  return {
    essays,
    rubrics,
    chain,
    selectedId,
    loading,
    grading,
    error,
    latestDraft: chain.length > 0 ? chain[chain.length - 1] : null,
    openEssay,
    closeEssay,
    saveDraft,
    grade,
    saveRubric,
    deleteRubric,
  };
}

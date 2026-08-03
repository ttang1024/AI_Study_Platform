import { useCallback, useEffect, useState } from 'react';
import classroomService, {
  type ClassroomAssignment,
  type ClassroomAssignmentDetail,
  type SaveAssignmentInput,
} from '../services/classroomService';

/**
 * The assignment list for one classroom, plus whichever assignment is open.
 *
 * The list and the detail are separate fetches on purpose: the list is the same payload for
 * everyone in a role, while the detail is where the server decides whether you get one submission
 * or the whole roster's. Merging them would mean re-fetching every student's work to refresh a
 * due-date badge.
 */
export function useClassroomAssignments(classroomId: string | undefined, enabled: boolean) {
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [open, setOpen] = useState<ClassroomAssignmentDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    if (!classroomId) return;
    try {
      const res = await classroomService.getAssignments(classroomId);
      setAssignments(res.data?.data ?? []);
      setError('');
    } catch {
      setError('Assignments are unavailable right now.');
    } finally {
      setLoaded(true);
    }
  }, [classroomId]);

  useEffect(() => {
    // Only fetch once the tab is actually shown — most visits never open it. The fetch is inline
    // rather than a call to loadList so the state updates land in promise callbacks, not
    // synchronously in the effect.
    if (!enabled || !classroomId) return;
    let cancelled = false;
    classroomService
      .getAssignments(classroomId)
      .then((res) => {
        if (cancelled) return;
        setAssignments(res.data?.data ?? []);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Assignments are unavailable right now.');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, classroomId]);

  // Derived rather than a setState in the effect above: the spinner is a pure function of "the tab
  // is open and the first fetch has not landed", so there is no second source of truth to keep.
  const loading = enabled && !loaded;

  const openAssignment = useCallback(
    async (assignmentId: string) => {
      if (!classroomId) return;
      try {
        const res = await classroomService.getAssignment(classroomId, assignmentId);
        setOpen(res.data?.data ?? null);
      } catch {
        setError('That assignment could not be opened.');
      }
    },
    [classroomId],
  );

  const closeAssignment = useCallback(() => setOpen(null), []);

  /** Re-reads the open assignment in place, for actions that leave the panel open. */
  const refreshOpen = useCallback(async () => {
    const id = open?.assignment.classroomAssignmentId;
    if (!id) return;
    await openAssignment(id);
    await loadList();
  }, [open, openAssignment, loadList]);

  /**
   * Committing an action dismisses the panel and refreshes the list behind it.
   *
   * Deliberately not a refresh-in-place: saving, handing in and releasing a grade are all "I am done
   * with this one" actions, and re-reading a panel that is about to close would also throw away the
   * fetch. The list is what the user lands back on, so that is what gets re-read.
   */
  const closeAndRefreshList = useCallback(async () => {
    setOpen(null);
    await loadList();
  }, [loadList]);

  const createAssignment = useCallback(
    async (data: SaveAssignmentInput) => {
      if (!classroomId) return;
      await classroomService.createAssignment(classroomId, data);
      await loadList();
    },
    [classroomId, loadList],
  );

  const updateAssignment = useCallback(
    async (assignmentId: string, data: SaveAssignmentInput) => {
      if (!classroomId) return;
      await classroomService.updateAssignment(classroomId, assignmentId, data);
      await loadList();
      if (open?.assignment.classroomAssignmentId === assignmentId) await openAssignment(assignmentId);
    },
    [classroomId, loadList, open, openAssignment],
  );

  const deleteAssignment = useCallback(
    async (assignmentId: string) => {
      if (!classroomId) return;
      await classroomService.deleteAssignment(classroomId, assignmentId);
      if (open?.assignment.classroomAssignmentId === assignmentId) setOpen(null);
      await loadList();
    },
    [classroomId, loadList, open],
  );

  // Both of these throw on failure, so the panel only closes once the write actually landed — a
  // rejected save leaves the user's text on screen with the error beside it.
  const saveSubmission = useCallback(
    async (assignmentId: string, text: string, submit: boolean) => {
      if (!classroomId) return;
      await classroomService.saveSubmission(classroomId, assignmentId, text, submit);
      await closeAndRefreshList();
    },
    [classroomId, closeAndRefreshList],
  );

  const gradeSubmission = useCallback(
    async (assignmentId: string, studentUserId: string, points: number | null, feedback?: string) => {
      if (!classroomId) return;
      await classroomService.gradeSubmission(classroomId, assignmentId, studentUserId, points, feedback);
      // Clearing a grade is a correction, not a completion: the instructor is still working through
      // this assignment, so that one stays open and just re-reads.
      if (points === null) await refreshOpen();
      else await closeAndRefreshList();
    },
    [classroomId, closeAndRefreshList, refreshOpen],
  );

  return {
    assignments,
    open,
    loading,
    error,
    openAssignment,
    closeAssignment,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    saveSubmission,
    gradeSubmission,
  };
}

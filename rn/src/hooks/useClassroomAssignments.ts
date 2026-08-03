import { useCallback, useEffect, useState } from 'react';

import {
  classroomService,
  type ClassroomAssignment,
  type ClassroomAssignmentDetail,
} from '@/services/classroomService';

/**
 * Assignments for one classroom, plus whichever one is open.
 *
 * Mirrors the web hook, minus authoring: setting work is a long-form writing task that belongs on a
 * keyboard, so mobile does the two things people actually do on a phone — hand work in, and grade it.
 */
export function useClassroomAssignments(classroomId: string, enabled: boolean) {
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [open, setOpen] = useState<ClassroomAssignmentDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await classroomService.getAssignments(classroomId);
      setAssignments(res.data?.data ?? []);
    } catch {
      setAssignments([]);
    } finally {
      setLoaded(true);
    }
  }, [classroomId]);

  useEffect(() => {
    // Only once the tab is shown — most visits never open it. The fetch is inline rather than a call
    // to loadList so the state updates land in promise callbacks, not synchronously in the effect.
    if (!enabled) return;
    let cancelled = false;
    classroomService
      .getAssignments(classroomId)
      .then((res) => {
        if (!cancelled) setAssignments(res.data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setAssignments([]);
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
      try {
        const res = await classroomService.getAssignment(classroomId, assignmentId);
        setOpen(res.data?.data ?? null);
      } catch {
        setOpen(null);
      }
    },
    [classroomId],
  );

  const closeAssignment = useCallback(() => setOpen(null), []);

  /** Re-reads the open assignment in place, for actions that leave the sheet up. */
  const refreshOpen = useCallback(async () => {
    const id = open?.assignment.classroomAssignmentId;
    if (!id) return;
    await openAssignment(id);
    await loadList();
  }, [open, openAssignment, loadList]);

  /**
   * Committing an action dismisses the sheet and refreshes the list behind it.
   *
   * Deliberately not a refresh-in-place: saving, handing in and releasing a grade are all "I am done
   * with this one" actions, and re-reading a sheet that is about to close would also throw away the
   * fetch. The list is what the user lands back on, so that is what gets re-read.
   */
  const closeAndRefreshList = useCallback(async () => {
    setOpen(null);
    await loadList();
  }, [loadList]);

  // Both of these throw on failure, so the sheet only closes once the write actually landed.
  const saveSubmission = useCallback(
    async (assignmentId: string, text: string, submit: boolean) => {
      await classroomService.saveSubmission(classroomId, assignmentId, text, submit);
      await closeAndRefreshList();
    },
    [classroomId, closeAndRefreshList],
  );

  const gradeSubmission = useCallback(
    async (assignmentId: string, studentUserId: string, points: number | null, feedback?: string) => {
      await classroomService.gradeSubmission(classroomId, assignmentId, studentUserId, points, feedback);
      // Clearing a grade is a correction, not a completion: the instructor is still working through
      // this assignment, so that one stays open and just re-reads.
      if (points === null) await refreshOpen();
      else await closeAndRefreshList();
    },
    [classroomId, closeAndRefreshList, refreshOpen],
  );

  return { assignments, open, loading, openAssignment, closeAssignment, saveSubmission, gradeSubmission };
}

import { useCallback, useEffect, useState } from 'react';
import classroomService, {
  type ClassroomDetail,
  type ClassroomRole,
  type Gradebook,
  type StudentProgress,
} from '../services/classroomService';
import { apiClient } from '../services/apiClient';
import { useStudy } from '../context/StudyContext';

/**
 * Data and mutations for one classroom.
 *
 * The gradebook is fetched separately and only for graders: the endpoint 403s for students, and
 * firing it anyway would put a guaranteed failed request in every student's network tab.
 */
export function useClassroomDetail(classroomId: string | undefined) {
  const { courses } = useStudy();
  const [detail, setDetail] = useState<ClassroomDetail | null>(null);
  const [gradebook, setGradebook] = useState<Gradebook | null>(null);
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const isGrader = detail ? detail.myRole !== 'student' : false;
  const canManage = detail?.myRole === 'instructor';

  const loadDetail = useCallback(async () => {
    if (!classroomId) return;
    try {
      const res = await classroomService.getClassroom(classroomId);
      setDetail(res.data?.data ?? null);
      setError('');
    } catch {
      setError('This classroom is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  const loadGradebook = useCallback(async () => {
    if (!classroomId) return;
    try {
      const res = await classroomService.getGradebook(classroomId);
      setGradebook(res.data?.data ?? null);
    } catch {
      setGradebook(null);
    }
  }, [classroomId]);

  useEffect(() => {
    setLoading(true);
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (isGrader) void loadGradebook();
  }, [isGrader, loadGradebook]);

  const openStudent = useCallback(
    async (studentUserId: string) => {
      if (!classroomId) return;
      setStudentProgress(null);
      try {
        const res = await classroomService.getStudentProgress(classroomId, studentUserId);
        setStudentProgress(res.data?.data ?? null);
      } catch {
        setStudentProgress(null);
      }
    },
    [classroomId],
  );

  const closeStudent = useCallback(() => setStudentProgress(null), []);

  // Fetched through apiClient rather than linked directly, because the export is bearer-authenticated
  // and a plain <a href> would send no token.
  const exportCsv = useCallback(async () => {
    if (!classroomId) return;
    setExporting(true);
    try {
      const response = await apiClient.get(classroomService.gradebookCsvPath(classroomId), {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail?.name ?? 'gradebook'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('The gradebook could not be exported.');
    } finally {
      setExporting(false);
    }
  }, [classroomId, detail?.name]);

  const assignCourse = useCallback(
    async (courseId: string, dueAt?: string) => {
      if (!classroomId) return;
      await classroomService.assignCourse(classroomId, courseId, dueAt);
      await loadDetail();
      if (isGrader) await loadGradebook();
    },
    [classroomId, isGrader, loadDetail, loadGradebook],
  );

  const unassignCourse = useCallback(
    async (classroomCourseId: string) => {
      if (!classroomId) return;
      await classroomService.unassignCourse(classroomId, classroomCourseId);
      await loadDetail();
      if (isGrader) await loadGradebook();
    },
    [classroomId, isGrader, loadDetail, loadGradebook],
  );

  const setRole = useCallback(
    async (userId: string, role: ClassroomRole) => {
      if (!classroomId) return;
      await classroomService.setRole(classroomId, userId, role);
      await loadDetail();
    },
    [classroomId, loadDetail],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!classroomId) return;
      await classroomService.removeEnrollment(classroomId, userId);
      await loadDetail();
      if (isGrader) await loadGradebook();
    },
    [classroomId, isGrader, loadDetail, loadGradebook],
  );

  const setArchived = useCallback(
    async (archived: boolean) => {
      if (!classroomId) return;
      await classroomService.archiveClassroom(classroomId, archived);
      await loadDetail();
    },
    [classroomId, loadDetail],
  );

  const rotateJoinCode = useCallback(async () => {
    if (!classroomId) return;
    await classroomService.rotateJoinCode(classroomId);
    await loadDetail();
  }, [classroomId, loadDetail]);

  const setEnrollmentOpen = useCallback(
    async (open: boolean) => {
      if (!classroomId) return;
      await classroomService.setEnrollmentOpen(classroomId, open);
      await loadDetail();
    },
    [classroomId, loadDetail],
  );

  /** Resolves to the server's message on failure, or null on success. */
  const addMember = useCallback(
    async (email: string, role: ClassroomRole): Promise<string | null> => {
      if (!classroomId) return 'This classroom is unavailable.';
      try {
        await classroomService.addMember(classroomId, email, role);
        await loadDetail();
        if (isGrader) await loadGradebook();
        return null;
      } catch (err) {
        // The server's wording is the useful part here ("No account exists for that email."), so it
        // is surfaced rather than replaced with a generic failure.
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        return message ?? 'That person could not be added.';
      }
    },
    [classroomId, isGrader, loadDetail, loadGradebook],
  );

  // Courses already assigned are filtered out of the picker rather than disabled — re-assigning is
  // a no-op that only edits the due date, which is not what the "Assign" button implies.
  const assignedCourseIds = new Set((detail?.courses ?? []).map((c) => c.courseId));
  const assignableCourses = courses.filter((c) => !assignedCourseIds.has(c.id));

  return {
    detail,
    gradebook,
    studentProgress,
    loading,
    error,
    exporting,
    isGrader,
    canManage,
    assignableCourses,
    openStudent,
    closeStudent,
    exportCsv,
    assignCourse,
    unassignCourse,
    setRole,
    removeMember,
    setArchived,
    rotateJoinCode,
    setEnrollmentOpen,
    addMember,
  };
}

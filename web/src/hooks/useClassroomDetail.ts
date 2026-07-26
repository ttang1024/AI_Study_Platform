import { useCallback, useEffect, useState } from 'react';
import classroomService, {
  type ClassroomDetail,
  type ClassroomRole,
  type Gradebook,
  type StudentProgress,
} from '../services/classroomService';
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
    isGrader,
    canManage,
    assignableCourses,
    openStudent,
    closeStudent,
    assignCourse,
    unassignCourse,
    setRole,
    removeMember,
    setArchived,
  };
}

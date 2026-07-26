import type { HttpClient } from '../http';

export type OrganizationRole = 'owner' | 'admin' | 'instructor' | 'member';
export type ClassroomRole = 'instructor' | 'assistant' | 'student';

export interface Organization {
  organizationId: string;
  name: string;
  slug: string;
  myRole: OrganizationRole;
  memberCount: number;
  classroomCount: number;
  createdAt: string;
}

export interface OrganizationMember {
  userId: string;
  fullName: string;
  email: string;
  role: OrganizationRole;
  joinedAt: string;
}

export interface OrganizationDetail {
  organizationId: string;
  name: string;
  slug: string;
  myRole: OrganizationRole;
  createdAt: string;
  members: OrganizationMember[];
}

export interface Classroom {
  classroomId: string;
  organizationId: string;
  organizationName: string;
  name: string;
  description?: string;
  myRole: ClassroomRole;
  /** Null for anyone who cannot manage the classroom — the server withholds it. */
  joinCode: string | null;
  studentCount: number;
  courseCount: number;
  isArchived: boolean;
  createdAt: string;
}

export interface ClassroomRosterEntry {
  userId: string;
  fullName: string;
  email: string;
  role: ClassroomRole;
  enrolledAt: string;
}

export interface ClassroomCourse {
  classroomCourseId: string;
  courseId: string;
  courseName: string;
  assignedAt: string;
  dueAt?: string;
}

export interface ClassroomDetail {
  classroomId: string;
  organizationId: string;
  name: string;
  description?: string;
  myRole: ClassroomRole;
  joinCode: string | null;
  isArchived: boolean;
  createdAt: string;
  roster: ClassroomRosterEntry[];
  courses: ClassroomCourse[];
}

export interface GradebookCourse {
  courseId: string;
  courseName: string;
  dueAt?: string;
}

/**
 * `averageScorePercent` is null rather than 0 when the student has not attempted
 * anything — "not started" and "scored 0%" must render differently.
 */
export interface GradebookCell {
  courseId: string;
  quizSubmissions: number;
  averageScorePercent: number | null;
  problemsAttempted: number;
  problemsCorrect: number;
  studyMinutes: number;
  lastActivityAt?: string;
}

export interface GradebookRow {
  userId: string;
  fullName: string;
  email: string;
  cells: GradebookCell[];
  overallScorePercent: number | null;
  totalStudyMinutes: number;
  lastActivityAt?: string;
}

export interface Gradebook {
  classroomId: string;
  courses: GradebookCourse[];
  rows: GradebookRow[];
}

export interface TopicMastery {
  topic: string;
  attempted: number;
  correct: number;
}

export interface StudentProgress {
  userId: string;
  fullName: string;
  email: string;
  cells: GradebookCell[];
  weakestTopics: TopicMastery[];
  studyMinutesTrend: { date: string; value: number }[];
}

// Returns raw HttpResponses (callers read `.data.data`), matching the convention
// the other shared services use.
export function createClassroomService(http: HttpClient) {
  return {
    // ── Organizations ──────────────────────────────────────────────────────
    getMyOrganizations: () => http.get<{ data: Organization[] }>('/api/organizations'),

    getOrganization: (id: string) => http.get<{ data: OrganizationDetail }>(`/api/organizations/${id}`),

    createOrganization: (name: string) =>
      http.post<{ data: Organization }>('/api/organizations', { name }),

    inviteMember: (organizationId: string, email: string, role: OrganizationRole) =>
      http.post<{ data: OrganizationMember }>(`/api/organizations/${organizationId}/members`, { email, role }),

    removeOrganizationMember: (organizationId: string, userId: string) =>
      http.delete(`/api/organizations/${organizationId}/members/${userId}`),

    // ── Classrooms ─────────────────────────────────────────────────────────
    getMyClassrooms: () => http.get<{ data: Classroom[] }>('/api/classrooms'),

    getClassroom: (id: string) => http.get<{ data: ClassroomDetail }>(`/api/classrooms/${id}`),

    createClassroom: (data: { organizationId: string; name: string; description?: string }) =>
      http.post<{ data: Classroom }>('/api/classrooms', data),

    joinClassroom: (joinCode: string) =>
      http.post<{ data: Classroom }>('/api/classrooms/join', { joinCode }),

    archiveClassroom: (id: string, archived: boolean) =>
      http.put<{ data: boolean }>(`/api/classrooms/${id}/archive`, { archived }),

    // ── Roster ─────────────────────────────────────────────────────────────
    setRole: (classroomId: string, userId: string, role: ClassroomRole) =>
      http.put<{ data: boolean }>(`/api/classrooms/${classroomId}/roster/${userId}/role`, { role }),

    /** Passing your own userId leaves the classroom. */
    removeEnrollment: (classroomId: string, userId: string) =>
      http.delete(`/api/classrooms/${classroomId}/roster/${userId}`),

    // ── Course assignment ──────────────────────────────────────────────────
    assignCourse: (classroomId: string, courseId: string, dueAt?: string) =>
      http.post<{ data: ClassroomCourse }>(`/api/classrooms/${classroomId}/courses`, { courseId, dueAt }),

    unassignCourse: (classroomId: string, classroomCourseId: string) =>
      http.delete(`/api/classrooms/${classroomId}/courses/${classroomCourseId}`),

    // ── Gradebook ──────────────────────────────────────────────────────────
    getGradebook: (classroomId: string) =>
      http.get<{ data: Gradebook }>(`/api/classrooms/${classroomId}/gradebook`),

    getStudentProgress: (classroomId: string, studentUserId: string) =>
      http.get<{ data: StudentProgress }>(`/api/classrooms/${classroomId}/students/${studentUserId}/progress`),
  };
}

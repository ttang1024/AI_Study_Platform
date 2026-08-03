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
  /** When false the join code is refused whatever it is. */
  enrollmentOpen: boolean;
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
  enrollmentOpen: boolean;
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

/** A published assignment, as a gradebook column. Drafts never appear. */
export interface GradebookAssignment {
  classroomAssignmentId: string;
  title: string;
  pointsPossible: number;
  dueAt?: string;
}

/** `pointsAwarded` stays null until the grade is released — read `status` for the rest. */
export interface GradebookSubmissionCell {
  classroomAssignmentId: string;
  status: SubmissionStatus;
  pointsAwarded: number | null;
  submittedAt?: string;
}

export interface GradebookRow {
  userId: string;
  fullName: string;
  email: string;
  cells: GradebookCell[];
  overallScorePercent: number | null;
  totalStudyMinutes: number;
  lastActivityAt?: string;
  /** One entry per published assignment, same order as `Gradebook.assignments`. */
  assignments: GradebookSubmissionCell[];
  /** Points earned over points available across graded assignments only. */
  assignmentScorePercent: number | null;
  assignmentsSubmitted: number;
  assignmentsGraded: number;
}

export interface Gradebook {
  classroomId: string;
  courses: GradebookCourse[];
  rows: GradebookRow[];
  assignments: GradebookAssignment[];
}

export type SubmissionStatus = 'not_started' | 'draft' | 'submitted' | 'late' | 'graded';

/**
 * The role-dependent tail fields are null for the other side: a student never receives
 * `submittedCount`, and staff never receive `myStatus`. Render off whichever is present rather
 * than off a separate role flag.
 */
export interface ClassroomAssignment {
  classroomAssignmentId: string;
  classroomId: string;
  title: string;
  instructions?: string;
  courseId?: string;
  courseName?: string;
  pointsPossible: number;
  dueAt?: string;
  allowLateSubmissions: boolean;
  isPublished: boolean;
  createdAt: string;
  /** Student view. */
  myStatus: SubmissionStatus | null;
  /** Null until the instructor releases the grade, even once scored. */
  myPointsAwarded: number | null;
  /** Staff view. */
  submittedCount: number | null;
  gradedCount: number | null;
  studentCount: number | null;
}

export interface ClassroomSubmission {
  /** Null on a roster row for a student who has not started. */
  classroomSubmissionId: string | null;
  classroomAssignmentId: string;
  studentUserId: string;
  studentName: string;
  /** Empty string when the server withheld it — a draft is private even from staff. */
  text: string;
  status: SubmissionStatus;
  submittedAt?: string;
  pointsAwarded: number | null;
  feedback?: string;
  gradedAt?: string;
}

export interface ClassroomAssignmentDetail {
  assignment: ClassroomAssignment;
  /** The caller's own work. Null for staff. */
  mySubmission: ClassroomSubmission | null;
  /** One row per student, roster order. Null — not empty — for students. */
  submissions: ClassroomSubmission[] | null;
}

export interface SaveAssignmentInput {
  title: string;
  instructions?: string;
  courseId?: string;
  pointsPossible: number;
  dueAt?: string;
  allowLateSubmissions: boolean;
  publish: boolean;
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
  assignments: GradebookAssignment[];
  submissions: GradebookSubmissionCell[];
  assignmentScorePercent: number | null;
}

/**
 * Outstanding classwork for the signed-in student, across every classroom. Work already handed in is
 * excluded; overdue work is not, and carries `isOverdue`.
 */
export interface ClassroomDeadline {
  classroomId: string;
  classroomName: string;
  /** Null when the deadline comes from an assigned course rather than an assignment. */
  classroomAssignmentId: string | null;
  courseId: string | null;
  title: string;
  dueAt: string;
  /** A SubmissionStatus for assignments, `'course'` for course deadlines. */
  status: SubmissionStatus | 'course';
  isOverdue: boolean;
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

    /** Issues a new join code and invalidates the old one. Enrolled students are unaffected. */
    rotateJoinCode: (classroomId: string) =>
      http.post<{ data: string }>(`/api/classrooms/${classroomId}/join-code/rotate`, {}),

    /** Opens or closes self-enrollment without changing the code. */
    setEnrollmentOpen: (classroomId: string, open: boolean) =>
      http.put<{ data: boolean }>(`/api/classrooms/${classroomId}/enrollment`, { open }),

    // ── Roster ─────────────────────────────────────────────────────────────
    /** Enrolls by email, no code needed. Re-adding a removed student restores their history. */
    addMember: (classroomId: string, email: string, role: ClassroomRole) =>
      http.post<{ data: ClassroomRosterEntry }>(`/api/classrooms/${classroomId}/roster`, { email, role }),

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

    // ── Assignments ────────────────────────────────────────────────────────
    getAssignments: (classroomId: string) =>
      http.get<{ data: ClassroomAssignment[] }>(`/api/classrooms/${classroomId}/assignments`),

    getAssignment: (classroomId: string, assignmentId: string) =>
      http.get<{ data: ClassroomAssignmentDetail }>(
        `/api/classrooms/${classroomId}/assignments/${assignmentId}`,
      ),

    createAssignment: (classroomId: string, data: SaveAssignmentInput) =>
      http.post<{ data: ClassroomAssignment }>(`/api/classrooms/${classroomId}/assignments`, data),

    updateAssignment: (classroomId: string, assignmentId: string, data: SaveAssignmentInput) =>
      http.put<{ data: ClassroomAssignment }>(
        `/api/classrooms/${classroomId}/assignments/${assignmentId}`,
        data,
      ),

    deleteAssignment: (classroomId: string, assignmentId: string) =>
      http.delete(`/api/classrooms/${classroomId}/assignments/${assignmentId}`),

    // ── Submissions ────────────────────────────────────────────────────────
    /** Writes the caller's own submission. `submit: false` saves a draft nobody else can read. */
    saveSubmission: (classroomId: string, assignmentId: string, text: string, submit: boolean) =>
      http.put<{ data: ClassroomSubmission }>(
        `/api/classrooms/${classroomId}/assignments/${assignmentId}/submission`,
        { text, submit },
      ),

    /** Staff only. A null score clears the grade and hands editing back to the student. */
    gradeSubmission: (
      classroomId: string,
      assignmentId: string,
      studentUserId: string,
      pointsAwarded: number | null,
      feedback?: string,
    ) =>
      http.put<{ data: ClassroomSubmission }>(
        `/api/classrooms/${classroomId}/assignments/${assignmentId}/submissions/${studentUserId}/grade`,
        { pointsAwarded, feedback },
      ),

    // ── Gradebook ──────────────────────────────────────────────────────────
    getGradebook: (classroomId: string) =>
      http.get<{ data: Gradebook }>(`/api/classrooms/${classroomId}/gradebook`),

    getStudentProgress: (classroomId: string, studentUserId: string) =>
      http.get<{ data: StudentProgress }>(`/api/classrooms/${classroomId}/students/${studentUserId}/progress`),

    /** Path only — the caller downloads it themselves, since auth headers differ per app. */
    gradebookCsvPath: (classroomId: string) => `/api/classrooms/${classroomId}/gradebook.csv`,

    // ── Deadlines ──────────────────────────────────────────────────────────
    getDeadlines: (days = 14) =>
      http.get<{ data: ClassroomDeadline[] }>(`/api/classrooms/deadlines?days=${days}`),
  };
}

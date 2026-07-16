import type { HttpClient } from '../http';

export interface GroupMember {
  userId: string;
  userName: string;
  role: string;
  joinedAt: string;
}

export interface SharedCourse {
  courseId: string;
  courseName: string;
  sharedAt: string;
  sharedByUserId: string;
}

export interface StudyGroup {
  studyGroupId: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  sharedCourseCount: number;
}

export interface StudyGroupDetail {
  studyGroupId: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdAt: string;
  memberCount?: number;
  sharedCourseCount?: number;
  members: GroupMember[];
  sharedCourses: SharedCourse[];
}

export interface GroupChatMessage {
  groupChatMessageId: string;
  userId: string;
  userName: string;
  content: string;
  sentAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  rank: number;
  xp: number;
  studyMinutes: number;
  quizCorrect: number;
  isMe: boolean;
}

export interface GroupLeaderboard {
  groupId: string;
  days: number;
  entries: LeaderboardEntry[];
}

// Field names verified against server BattleFeature.cs: BattleQuestionDto(Id, …),
// BattleResultItemDto(QuestionId, …). (rn's old local types said `quizId`, which
// the backend never sends.)
export interface BattleQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface BattleEntry {
  userId: string;
  name: string;
  score: number;
  total: number;
  durationSeconds: number;
  completedAt: string;
  rank: number;
  isMe: boolean;
}

export interface Battle {
  id: string;
  groupId: string;
  createdByUserId: string;
  title: string;
  status: string;
  questionCount: number;
  createdAt: string;
  iHavePlayed: boolean;
  entries: BattleEntry[];
}

export interface BattlePlay {
  battle: Battle;
  questions: BattleQuestion[];
}

export interface BattleResultItem {
  questionId: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  correct: boolean;
  explanation: string;
}

export interface BattleResult {
  score: number;
  total: number;
  items: BattleResultItem[];
  battle: Battle;
}

export interface AssignmentCompletion {
  userId: string;
  name: string;
  completedAt: string;
}

export interface Assignment {
  id: string;
  groupId: string;
  createdByUserId: string;
  title: string;
  description?: string;
  linkUrl?: string;
  dueAt?: string;
  createdAt: string;
  completedByMe: boolean;
  completedCount: number;
  memberCount: number;
  completions: AssignmentCompletion[];
}

// Returns raw HttpResponses (callers read `.data.data`), matching the web call
// sites this was extracted from; rn's shim unwraps.
export function createStudyGroupService(http: HttpClient) {
  return {
    getMyGroups: () => http.get<{ data: StudyGroup[] }>('/api/study-groups'),

    getDetail: (id: string) => http.get<{ data: StudyGroupDetail }>(`/api/study-groups/${id}`),

    create: (data: { name: string; description?: string }) =>
      http.post<{ data: StudyGroup }>('/api/study-groups', data),

    join: (inviteCode: string) =>
      http.post<{ data: StudyGroup }>('/api/study-groups/join', { inviteCode }),

    leave: (id: string) => http.delete(`/api/study-groups/${id}/leave`),

    deleteGroup: (id: string) => http.delete(`/api/study-groups/${id}`),

    removeMember: (groupId: string, userId: string) =>
      http.delete(`/api/study-groups/${groupId}/members/${userId}`),

    shareCourse: (groupId: string, courseId: string) =>
      http.post<{ data: SharedCourse }>(`/api/study-groups/${groupId}/share-course`, { courseId }),

    unshareCourse: (groupId: string, courseId: string) =>
      http.delete(`/api/study-groups/${groupId}/shared-courses/${courseId}`),

    getChat: (groupId: string, page = 1) =>
      http.get<{ data: GroupChatMessage[] }>(`/api/study-groups/${groupId}/chat?page=${page}`),

    sendMessage: (groupId: string, content: string) =>
      http.post<{ data: GroupChatMessage }>(`/api/study-groups/${groupId}/chat`, { content }),

    getLeaderboard: (groupId: string, days = 7) =>
      http.get<{ data: GroupLeaderboard }>(`/api/study-groups/${groupId}/leaderboard?days=${days}`),

    getBattles: (groupId: string) =>
      http.get<{ data: Battle[] }>(`/api/study-groups/${groupId}/battles`),

    createBattle: (groupId: string, data: { title?: string; courseId?: string; count: number }) =>
      http.post<{ data: Battle }>(`/api/study-groups/${groupId}/battles`, data),

    getBattle: (battleId: string) =>
      http.get<{ data: BattlePlay }>(`/api/study-groups/battles/${battleId}`),

    submitBattleEntry: (battleId: string, answers: Record<string, string>, durationSeconds: number) =>
      http.post<{ data: BattleResult }>(`/api/study-groups/battles/${battleId}/entries`, {
        answers,
        durationSeconds,
      }),

    getAssignments: (groupId: string) =>
      http.get<{ data: Assignment[] }>(`/api/study-groups/${groupId}/assignments`),

    createAssignment: (
      groupId: string,
      data: { title: string; description?: string; linkUrl?: string; dueAt?: string },
    ) => http.post<{ data: Assignment }>(`/api/study-groups/${groupId}/assignments`, data),

    setAssignmentCompletion: (assignmentId: string, completed: boolean) =>
      http.post<{ data: Assignment }>(`/api/study-groups/assignments/${assignmentId}/completion`, {
        completed,
      }),

    deleteAssignment: (assignmentId: string) =>
      http.delete(`/api/study-groups/assignments/${assignmentId}`),
  };
}

export type StudyGroupService = ReturnType<typeof createStudyGroupService>;

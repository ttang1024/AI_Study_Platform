import { apiClient } from './apiClient';

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

const studyGroupService = {
  getMyGroups: () =>
    apiClient.get<{ data: StudyGroup[] }>('/api/study-groups'),

  getDetail: (id: string) =>
    apiClient.get<{ data: StudyGroupDetail }>(`/api/study-groups/${id}`),

  create: (data: { name: string; description?: string }) =>
    apiClient.post<{ data: StudyGroup }>('/api/study-groups', data),

  join: (inviteCode: string) =>
    apiClient.post<{ data: StudyGroup }>('/api/study-groups/join', { inviteCode }),

  leave: (id: string) =>
    apiClient.delete(`/api/study-groups/${id}/leave`),

  deleteGroup: (id: string) =>
    apiClient.delete(`/api/study-groups/${id}`),

  removeMember: (groupId: string, userId: string) =>
    apiClient.delete(`/api/study-groups/${groupId}/members/${userId}`),

  shareCourse: (groupId: string, courseId: string) =>
    apiClient.post(`/api/study-groups/${groupId}/share-course`, { courseId }),

  unshareCourse: (groupId: string, courseId: string) =>
    apiClient.delete(`/api/study-groups/${groupId}/shared-courses/${courseId}`),

  getChat: (groupId: string, page = 1) =>
    apiClient.get<{ data: GroupChatMessage[] }>(`/api/study-groups/${groupId}/chat?page=${page}`),

  sendMessage: (groupId: string, content: string) =>
    apiClient.post<{ data: GroupChatMessage }>(`/api/study-groups/${groupId}/chat`, { content }),

  getLeaderboard: (groupId: string, days = 7) =>
    apiClient.get<{ data: GroupLeaderboard }>(`/api/study-groups/${groupId}/leaderboard?days=${days}`),

  getBattles: (groupId: string) =>
    apiClient.get<{ data: Battle[] }>(`/api/study-groups/${groupId}/battles`),

  createBattle: (groupId: string, data: { title: string; courseId?: string; count: number }) =>
    apiClient.post<{ data: Battle }>(`/api/study-groups/${groupId}/battles`, data),

  getBattle: (battleId: string) =>
    apiClient.get<{ data: BattlePlay }>(`/api/study-groups/battles/${battleId}`),

  submitBattleEntry: (battleId: string, answers: Record<string, string>, durationSeconds: number) =>
    apiClient.post<{ data: BattleResult }>(`/api/study-groups/battles/${battleId}/entries`, { answers, durationSeconds }),

  getAssignments: (groupId: string) =>
    apiClient.get<{ data: Assignment[] }>(`/api/study-groups/${groupId}/assignments`),

  createAssignment: (groupId: string, data: { title: string; description?: string; linkUrl?: string; dueAt?: string }) =>
    apiClient.post<{ data: Assignment }>(`/api/study-groups/${groupId}/assignments`, data),

  setAssignmentCompletion: (assignmentId: string, completed: boolean) =>
    apiClient.post<{ data: Assignment }>(`/api/study-groups/assignments/${assignmentId}/completion`, { completed }),

  deleteAssignment: (assignmentId: string) =>
    apiClient.delete(`/api/study-groups/assignments/${assignmentId}`),
};

export default studyGroupService;

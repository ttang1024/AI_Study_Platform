import { apiClient } from '@/services/apiClient';
import type { GroupChatMessage } from '@/services/groupChatSocket';

export interface StudyGroup {
  studyGroupId: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  sharedCourseCount: number;
}

export interface GroupMember {
  userId: string;
  userName: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface SharedCourse {
  courseId: string;
  courseName: string;
  sharedAt: string;
  sharedByUserId: string;
}

export interface StudyGroupDetail extends StudyGroup {
  members: GroupMember[];
  sharedCourses: SharedCourse[];
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

// The play payload deliberately withholds the correct answer — graded server-side on submit.
export interface BattleQuestion {
  quizId: string;
  question: string;
  options: string[];
}

export interface BattlePlay {
  battle: Battle;
  questions: BattleQuestion[];
}

export interface BattleResultItem {
  quizId: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  correct: boolean;
  explanation: string;
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

export interface BattleResult {
  score: number;
  total: number;
  items: BattleResultItem[];
  battle: Battle;
}

export const studyGroupService = {
  async listMyGroups(): Promise<StudyGroup[]> {
    const res = await apiClient.get<{ data: StudyGroup[] }>('/api/study-groups');
    return res.data.data ?? [];
  },

  async createGroup(name: string, description?: string): Promise<StudyGroup> {
    const res = await apiClient.post<{ data: StudyGroup }>('/api/study-groups', { name, description });
    return res.data.data;
  },

  async getGroupDetail(id: string): Promise<StudyGroupDetail> {
    const res = await apiClient.get<{ data: StudyGroupDetail }>(`/api/study-groups/${id}`);
    return res.data.data;
  },

  async joinGroup(inviteCode: string): Promise<StudyGroup> {
    const res = await apiClient.post<{ data: StudyGroup }>('/api/study-groups/join', { inviteCode });
    return res.data.data;
  },

  async leaveGroup(id: string): Promise<void> {
    await apiClient.delete(`/api/study-groups/${id}/leave`);
  },

  async deleteGroup(id: string): Promise<void> {
    await apiClient.delete(`/api/study-groups/${id}`);
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    await apiClient.delete(`/api/study-groups/${groupId}/members/${userId}`);
  },

  async shareCourse(groupId: string, courseId: string): Promise<SharedCourse> {
    const res = await apiClient.post<{ data: SharedCourse }>(`/api/study-groups/${groupId}/share-course`, { courseId });
    return res.data.data;
  },

  async unshareCourse(groupId: string, courseId: string): Promise<void> {
    await apiClient.delete(`/api/study-groups/${groupId}/shared-courses/${courseId}`);
  },

  // Seed data only — live messages arrive over groupChatSocket's ReceiveMessage event.
  async getChatHistory(id: string): Promise<GroupChatMessage[]> {
    const res = await apiClient.get<{ data: GroupChatMessage[] }>(`/api/study-groups/${id}/chat`);
    return res.data.data ?? [];
  },

  async getLeaderboard(id: string, days: 7 | 30 = 7): Promise<GroupLeaderboard> {
    const res = await apiClient.get<{ data: GroupLeaderboard }>(`/api/study-groups/${id}/leaderboard?days=${days}`);
    return res.data.data;
  },

  async listBattles(id: string): Promise<Battle[]> {
    const res = await apiClient.get<{ data: Battle[] }>(`/api/study-groups/${id}/battles`);
    return res.data.data ?? [];
  },

  async createBattle(id: string, data: { title?: string; courseId?: string; count: number }): Promise<Battle> {
    const res = await apiClient.post<{ data: Battle }>(`/api/study-groups/${id}/battles`, data);
    return res.data.data;
  },

  async getBattle(battleId: string): Promise<BattlePlay> {
    const res = await apiClient.get<{ data: BattlePlay }>(`/api/study-groups/battles/${battleId}`);
    return res.data.data;
  },

  async submitBattle(battleId: string, answers: Record<string, string>, durationSeconds: number): Promise<BattleResult> {
    const res = await apiClient.post<{ data: BattleResult }>(`/api/study-groups/battles/${battleId}/entries`, { answers, durationSeconds });
    return res.data.data;
  },

  async listAssignments(groupId: string): Promise<Assignment[]> {
    const res = await apiClient.get<{ data: Assignment[] }>(`/api/study-groups/${groupId}/assignments`);
    return res.data.data ?? [];
  },

  async createAssignment(groupId: string, data: { title: string; description?: string; linkUrl?: string; dueAt?: string }): Promise<Assignment> {
    const res = await apiClient.post<{ data: Assignment }>(`/api/study-groups/${groupId}/assignments`, data);
    return res.data.data;
  },

  async setAssignmentCompletion(assignmentId: string, completed: boolean): Promise<Assignment> {
    const res = await apiClient.post<{ data: Assignment }>(`/api/study-groups/assignments/${assignmentId}/completion`, { completed });
    return res.data.data;
  },

  async deleteAssignment(assignmentId: string): Promise<void> {
    await apiClient.delete(`/api/study-groups/assignments/${assignmentId}`);
  },
};

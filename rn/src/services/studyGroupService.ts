// Service logic moved to the shared package (packages/core). This shim keeps
// rn's historical method names and unwrapped returns over the shared
// web-canonical factory. Battle field names were corrected in the move:
// BattleQuestion.id / BattleResultItem.questionId are what the server sends
// (the old local types said `quizId`, which never existed on the wire).
import {
  createStudyGroupService,
  type Assignment,
  type Battle,
  type BattlePlay,
  type BattleResult,
  type GroupLeaderboard,
  type SharedCourse,
  type StudyGroup,
  type StudyGroupDetail,
} from '@core/services/studyGroupService';
import { http } from '@/services/http';
import type { GroupChatMessage } from '@/services/groupChatSocket';

export type {
  Assignment,
  AssignmentCompletion,
  Battle,
  BattleEntry,
  BattlePlay,
  BattleQuestion,
  BattleResult,
  BattleResultItem,
  GroupLeaderboard,
  GroupMember,
  LeaderboardEntry,
  SharedCourse,
  StudyGroup,
  StudyGroupDetail,
} from '@core/services/studyGroupService';

const core = createStudyGroupService(http);

export const studyGroupService = {
  async listMyGroups(): Promise<StudyGroup[]> {
    return (await core.getMyGroups()).data.data ?? [];
  },

  async createGroup(name: string, description?: string): Promise<StudyGroup> {
    return (await core.create({ name, description })).data.data;
  },

  async getGroupDetail(id: string): Promise<StudyGroupDetail> {
    return (await core.getDetail(id)).data.data;
  },

  async joinGroup(inviteCode: string): Promise<StudyGroup> {
    return (await core.join(inviteCode)).data.data;
  },

  async leaveGroup(id: string): Promise<void> {
    await core.leave(id);
  },

  async deleteGroup(id: string): Promise<void> {
    await core.deleteGroup(id);
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    await core.removeMember(groupId, userId);
  },

  async shareCourse(groupId: string, courseId: string): Promise<SharedCourse> {
    return (await core.shareCourse(groupId, courseId)).data.data;
  },

  async unshareCourse(groupId: string, courseId: string): Promise<void> {
    await core.unshareCourse(groupId, courseId);
  },

  // Seed data only — live messages arrive over groupChatSocket's ReceiveMessage event.
  async getChatHistory(id: string): Promise<GroupChatMessage[]> {
    return ((await core.getChat(id)).data.data ?? []) as GroupChatMessage[];
  },

  async getLeaderboard(id: string, days: 7 | 30 = 7): Promise<GroupLeaderboard> {
    return (await core.getLeaderboard(id, days)).data.data;
  },

  async listBattles(id: string): Promise<Battle[]> {
    return (await core.getBattles(id)).data.data ?? [];
  },

  async createBattle(
    id: string,
    data: { title?: string; courseId?: string; count: number },
  ): Promise<Battle> {
    return (await core.createBattle(id, data)).data.data;
  },

  async getBattle(battleId: string): Promise<BattlePlay> {
    return (await core.getBattle(battleId)).data.data;
  },

  async submitBattle(
    battleId: string,
    answers: Record<string, string>,
    durationSeconds: number,
  ): Promise<BattleResult> {
    return (await core.submitBattleEntry(battleId, answers, durationSeconds)).data.data;
  },

  async listAssignments(groupId: string): Promise<Assignment[]> {
    return (await core.getAssignments(groupId)).data.data ?? [];
  },

  async createAssignment(
    groupId: string,
    data: { title: string; description?: string; linkUrl?: string; dueAt?: string },
  ): Promise<Assignment> {
    return (await core.createAssignment(groupId, data)).data.data;
  },

  async setAssignmentCompletion(assignmentId: string, completed: boolean): Promise<Assignment> {
    return (await core.setAssignmentCompletion(assignmentId, completed)).data.data;
  },

  async deleteAssignment(assignmentId: string): Promise<void> {
    await core.deleteAssignment(assignmentId);
  },
};

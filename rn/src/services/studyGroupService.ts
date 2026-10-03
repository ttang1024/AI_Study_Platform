// Service logic moved to the shared package (packages/core). This shim keeps
// rn's historical method names and unwrapped returns over the shared
// web-canonical factory.
import {
  createStudyGroupService,
  type SharedCourse,
  type StudyGroup,
  type StudyGroupDetail,
} from '@core/services/studyGroupService';
import { http } from '@/services/http';
import type { GroupChatMessage } from '@/services/groupChatSocket';

export type {
  GroupMember,
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
};

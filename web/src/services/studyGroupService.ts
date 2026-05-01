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

  shareCourse: (groupId: string, courseId: string) =>
    apiClient.post(`/api/study-groups/${groupId}/share-course`, { courseId }),

  unshareCourse: (groupId: string, courseId: string) =>
    apiClient.delete(`/api/study-groups/${groupId}/shared-courses/${courseId}`),

  getChat: (groupId: string, page = 1) =>
    apiClient.get<{ data: GroupChatMessage[] }>(`/api/study-groups/${groupId}/chat?page=${page}`),

  sendMessage: (groupId: string, content: string) =>
    apiClient.post<{ data: GroupChatMessage }>(`/api/study-groups/${groupId}/chat`, { content }),
};

export default studyGroupService;

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
  };
}


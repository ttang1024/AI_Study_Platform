import { apiClient } from './apiClient';

export interface GroupNoteSummary {
  id: string;
  groupId: string;
  title: string;
  contentPreview: string;
  createdBy: string;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupNote {
  id: string;
  groupId: string;
  title: string;
  /** Base64-encoded Yjs document state, used to hydrate the CRDT editor. */
  stateBase64: string;
  createdBy: string;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const groupNotesService = {
  listNotes: (groupId: string) =>
    apiClient.get<{ data: GroupNoteSummary[] }>(`/api/study-groups/${groupId}/notes`),

  getNote: (noteId: string) =>
    apiClient.get<{ data: GroupNote }>(`/api/study-groups/notes/${noteId}`),

  createNote: (groupId: string, title: string) =>
    apiClient.post<{ data: GroupNoteSummary }>(`/api/study-groups/${groupId}/notes`, { title }),

  deleteNote: (noteId: string) =>
    apiClient.delete(`/api/study-groups/notes/${noteId}`),
};

export default groupNotesService;

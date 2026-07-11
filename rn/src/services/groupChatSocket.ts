import * as signalR from '@microsoft/signalr';

import { API_URL } from '@/constants/env';
import { tokenStore } from '@/services/tokenStore';

export interface GroupChatMessage {
  groupChatMessageId: string;
  userId: string;
  userName: string;
  content: string;
  sentAt: string;
}

export interface GroupMemberEvent {
  userId: string;
  userName: string;
  role: string;
  joinedAt: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type StudyRoomStatus = 'studying' | 'break';

// Broadcast over the hub's `RoomState` event whenever anyone joins/leaves the
// live study room, flips status, or starts the shared timer. Room membership is
// keyed server-side by connection id, so disconnecting implicitly leaves the room.
export interface StudyRoomState {
  members: { userId: string; name: string; status: StudyRoomStatus }[];
  timerEndsAt: string | null;
  timerMinutes: number;
  timerStartedBy: string | null;
}

interface GroupChatListeners {
  onMessage?: (message: GroupChatMessage) => void;
  onMemberJoined?: (member: GroupMemberEvent) => void;
  onMemberLeft?: (userId: string) => void;
  onMemberRemoved?: (userId: string) => void;
  onRoomState?: (state: StudyRoomState) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
}

// Ports web's ad hoc signalr usage in StudyGroupDetailPage.tsx. Two backend quirks this closes
// over: (1) `POST /{id}/chat` doesn't broadcast — sends must go through `SendMessage` on the hub,
// never the REST route; (2) web never re-invokes `JoinGroup` after `onreconnected`, which silently
// drops you out of the group after any network blip — this class does, since mobile networks flap
// more than desktop.
export class GroupChatSocket {
  private connection: signalR.HubConnection | null = null;
  private groupId: string | null = null;

  async connect(groupId: string, listeners: GroupChatListeners): Promise<void> {
    this.groupId = groupId;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/group-chat`, {
        accessTokenFactory: async () => (await tokenStore.getAccessToken()) ?? '',
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveMessage', (message: GroupChatMessage) => listeners.onMessage?.(message));
    connection.on('MemberJoined', (member: GroupMemberEvent) => listeners.onMemberJoined?.(member));
    connection.on('MemberLeft', (userId: string) => listeners.onMemberLeft?.(userId));
    connection.on('MemberRemoved', (userId: string) => listeners.onMemberRemoved?.(userId));
    connection.on('RoomState', (state: StudyRoomState) => listeners.onRoomState?.(state));

    connection.onreconnecting(() => listeners.onConnectionStateChange?.('reconnecting'));
    connection.onreconnected(async () => {
      if (this.groupId) await connection.invoke('JoinGroup', this.groupId);
      listeners.onConnectionStateChange?.('connected');
    });
    connection.onclose(() => listeners.onConnectionStateChange?.('disconnected'));

    this.connection = connection;
    listeners.onConnectionStateChange?.('connecting');
    await connection.start();
    await connection.invoke('JoinGroup', groupId);
    listeners.onConnectionStateChange?.('connected');
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.connection || !this.groupId) throw new Error('Group chat socket is not connected');
    await this.connection.invoke('SendMessage', this.groupId, content);
  }

  async joinStudyRoom(): Promise<void> {
    await this.invokeRoom('JoinStudyRoom');
  }

  async leaveStudyRoom(): Promise<void> {
    await this.invokeRoom('LeaveStudyRoom');
  }

  async setStudyStatus(status: StudyRoomStatus): Promise<void> {
    await this.invokeRoom('SetStudyStatus', status);
  }

  async startRoomTimer(minutes: number): Promise<void> {
    await this.invokeRoom('StartRoomTimer', minutes);
  }

  private async invokeRoom(method: string, ...args: unknown[]): Promise<void> {
    if (!this.connection || !this.groupId) throw new Error('Group chat socket is not connected');
    await this.connection.invoke(method, this.groupId, ...args);
  }

  async disconnect(): Promise<void> {
    await this.connection?.stop();
    this.connection = null;
    this.groupId = null;
  }
}

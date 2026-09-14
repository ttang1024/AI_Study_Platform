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

interface GroupChatListeners {
  onMessage?: (message: GroupChatMessage) => void;
  onMemberJoined?: (member: GroupMemberEvent) => void;
  onMemberLeft?: (userId: string) => void;
  onMemberRemoved?: (userId: string) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
}

// Ports web's ad hoc signalr usage in StudyGroupDetailPage.tsx. One backend quirk this closes over:
// `POST /{id}/chat` doesn't broadcast — sends must go through `SendMessage` on the hub, never the
// REST route. Re-invoking `JoinGroup` after `onreconnected` is essential (hub group membership is
// per connection id, so a network blip silently drops you out of the group); web does the same now.
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

  async disconnect(): Promise<void> {
    await this.connection?.stop();
    this.connection = null;
    this.groupId = null;
  }
}

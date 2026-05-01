const STORAGE_KEY = 'sp_chat_conversations';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

function load(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(conversations: Conversation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export const chatStorage = {
  getConversations(): Conversation[] {
    return load().sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  },

  getConversation(id: string): Conversation | undefined {
    return load().find(c => c.id === id);
  },

  createConversation(): Conversation {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    save([conv, ...load()]);
    return conv;
  },

  deleteConversation(id: string): void {
    save(load().filter(c => c.id !== id));
  },

  addMessage(
    conversationId: string,
    role: 'user' | 'model',
    content: string,
    isError?: boolean,
  ): ConversationMessage {
    const all = load();
    const conv = all.find(c => c.id === conversationId);
    if (!conv) throw new Error('Conversation not found');
    const msg: ConversationMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(isError ? { isError: true } : {}),
    };
    conv.messages.push(msg);
    conv.updatedAt = new Date().toISOString();
    save(all);
    return msg;
  },

  updateTitle(conversationId: string, title: string): void {
    const all = load();
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.title = title;
      save(all);
    }
  },

  clearAll(): void {
    save([]);
  },
};

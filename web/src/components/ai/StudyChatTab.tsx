import React from 'react';
import { ChatPanel, ChatPanelRef } from './ChatPanel';
import { ChatConversationBar } from './ChatConversationBar';
import { cn } from '../../utils/cn';

/**
 * The AI-chat tab of a study panel: the thread switcher over the chat itself.
 *
 * <p>Document, article, audio and video pages all present the same chat with the same "add to
 * note" hand-off — only the placeholder differs — so the wiring lives here.</p>
 */
export const StudyChatTab = React.forwardRef<ChatPanelRef, {
  hidden: boolean;
  conversations: React.ComponentProps<typeof ChatConversationBar>['conversations'];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  messages: React.ComponentProps<typeof ChatPanel>['externalMessages'];
  onStreamSend: React.ComponentProps<typeof ChatPanel>['onExternalStreamSend'];
  onAddToNote: (html: string) => void;
  onTabChange?: React.ComponentProps<typeof ChatPanel>['onTabChange'];
  placeholder?: string;
}>(({
  hidden, conversations, activeConversationId, onSelectConversation, onNewConversation,
  onDeleteConversation, messages, onStreamSend, onAddToNote, onTabChange, placeholder,
}, ref) => (
  <div className={cn('flex-1 overflow-hidden flex flex-col', hidden && 'hidden')}>
    <ChatConversationBar
      conversations={conversations}
      activeId={activeConversationId}
      onSelect={onSelectConversation}
      onNew={onNewConversation}
      onDelete={onDeleteConversation}
    />
    <div className="flex-1 overflow-hidden">
      <ChatPanel
        ref={ref}
        onTabChange={onTabChange}
        externalMessages={messages}
        enableAttachments
        onExternalStreamSend={onStreamSend}
        onExternalAddToNote={onAddToNote}
        placeholder={placeholder}
      />
    </div>
  </div>
));

StudyChatTab.displayName = 'StudyChatTab';

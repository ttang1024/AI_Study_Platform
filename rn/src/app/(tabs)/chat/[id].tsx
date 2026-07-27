import { useLocalSearchParams } from 'expo-router';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { chatService } from '@/services/chatService';

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ChatThreadView
      key={id}
      getMessages={() => chatService.getMessages(id)}
      sendMessage={(text, onChunk, attachments) => chatService.streamMessage(id, text, onChunk, undefined, attachments)}
    />
  );
}

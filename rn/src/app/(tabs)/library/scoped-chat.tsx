import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect } from 'react';

import { ScopedChatPanel } from '@/components/chat/ScopedChatPanel';
import { ChatScopeType } from '@/services/chatService';

export default function ScopedChatScreen() {
  const { sourceType, sourceId, courseId, title } = useLocalSearchParams<{
    sourceType: ChatScopeType;
    sourceId: string;
    courseId?: string;
    title?: string;
  }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ title: title ? `Chat — ${title}` : 'Chat' });
  }, [navigation, title]);

  return <ScopedChatPanel sourceType={sourceType} sourceId={sourceId} courseId={courseId} title={title} />;
}

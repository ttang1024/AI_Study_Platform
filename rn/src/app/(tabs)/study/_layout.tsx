import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export default function StudyLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Study' }} />
      <Stack.Screen name="practice" options={{ title: 'Practice' }} />
      <Stack.Screen name="flashcards" options={{ headerShown: false }} />
      <Stack.Screen name="quizzes" options={{ headerShown: false }} />
      <Stack.Screen name="notes" options={{ title: 'Notes' }} />
      <Stack.Screen name="note-editor" options={{ title: 'Edit note' }} />
      <Stack.Screen name="glossary" options={{ title: 'Glossary' }} />
      <Stack.Screen name="groups" options={{ headerShown: false }} />
      <Stack.Screen name="planner" options={{ headerShown: false }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="insights" options={{ title: 'Insights' }} />
      <Stack.Screen name="concepts" options={{ headerShown: false }} />
      <Stack.Screen name="achievements" options={{ title: 'Achievements' }} />
      <Stack.Screen name="shared-link" options={{ title: 'Shared link' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors } from '@/constants/theme';

export default function QuizzesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Quizzes', headerLeft: () => <HeaderBackButton /> }} />
      <Stack.Screen name="timed-exam" options={{ title: 'Timed Exam', presentation: 'fullScreenModal' }} />
    </Stack>
  );
}

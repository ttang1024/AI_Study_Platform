import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors } from '@/constants/theme';

export default function PlannerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Planner', headerLeft: () => <HeaderBackButton /> }} />
      <Stack.Screen name="mock-exam" options={{ title: 'Mock Exam' }} />
    </Stack>
  );
}

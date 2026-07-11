import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors } from '@/constants/theme';

export default function GroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Study Groups', headerLeft: () => <HeaderBackButton /> }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="battle/[battleId]" options={{ title: 'Quiz Battle' }} />
    </Stack>
  );
}

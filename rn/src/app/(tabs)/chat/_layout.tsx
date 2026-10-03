import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'AI Chat' }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors } from '@/constants/theme';

export default function SummarizerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'AI Summarizer', headerLeft: () => <HeaderBackButton /> }} />
    </Stack>
  );
}

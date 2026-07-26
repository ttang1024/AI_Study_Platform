import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="ai-services" options={{ title: 'AI Services' }} />
      <Stack.Screen name="ai-usage" options={{ title: 'AI Usage' }} />
      <Stack.Screen name="plan" options={{ title: 'Plan' }} />
      <Stack.Screen name="language" options={{ title: 'Language' }} />
      <Stack.Screen name="voice" options={{ title: 'Voice' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="feedback" options={{ title: 'Feedback' }} />
    </Stack>
  );
}

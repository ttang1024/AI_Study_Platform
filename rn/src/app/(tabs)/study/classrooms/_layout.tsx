import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors } from '@/constants/theme';

export default function ClassroomsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Classrooms', headerLeft: () => <HeaderBackButton /> }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}

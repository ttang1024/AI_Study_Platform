import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors } from '@/constants/theme';

export default function ConceptsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Concepts', headerLeft: () => <HeaderBackButton /> }} />
    </Stack>
  );
}

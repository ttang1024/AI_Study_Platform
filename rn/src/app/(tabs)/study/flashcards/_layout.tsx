import { Stack } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors } from '@/constants/theme';

export default function FlashcardsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Flashcards', headerLeft: () => <HeaderBackButton /> }} />
      <Stack.Screen name="deck/[id]" options={{ title: '' }} />
      <Stack.Screen name="review" options={{ title: 'Review', presentation: 'fullScreenModal' }} />
    </Stack>
  );
}

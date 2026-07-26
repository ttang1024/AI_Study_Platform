import { Stack, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Search from 'lucide-react-native/icons/search';
import Sparkles from 'lucide-react-native/icons/sparkles';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Colors, Spacing } from '@/constants/theme';

// Anchor the stack on the index screen so cross-tab pushes to a detail
// screen (quiz history, calendar, concepts, …) still get a back button.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function LibraryLayout() {
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSidebar },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Library',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: Spacing.three }}>
              <Pressable onPress={() => router.push('/library/search')} hitSlop={8}>
                <Search size={20} color={Colors.primary} />
              </Pressable>
              <Pressable onPress={() => router.push('/summarizer')} hitSlop={8}>
                <Sparkles size={20} color={Colors.primary} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Stack.Screen name="course/[id]" options={{ title: '' }} />
      {/* Detail screens are also reached via cross-tab push from the AI Summarizer,
          which doesn't always yield a default header back button — force one. */}
      <Stack.Screen name="document/[id]" options={{ title: '', headerLeft: () => <HeaderBackButton /> }} />
      <Stack.Screen name="video/[id]" options={{ title: '', headerLeft: () => <HeaderBackButton /> }} />
      {/* Where a citation's "jump to source" lands. */}
      <Stack.Screen name="document/source" options={{ title: 'Source', headerLeft: () => <HeaderBackButton /> }} />
      <Stack.Screen name="scoped-chat" options={{ title: 'Chat' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
    </Stack>
  );
}

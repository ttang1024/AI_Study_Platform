import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { Colors } from '@/constants/theme';

/**
 * Nested Stack navigators (e.g. study/flashcards, study/quizzes) don't inherit
 * a back button on their root screen from the parent Stack, even when reached
 * via router.push. Use this as headerLeft on those root screens.
 */
export function HeaderBackButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={8}>
      <ChevronLeft size={24} color={Colors.primary} />
    </Pressable>
  );
}

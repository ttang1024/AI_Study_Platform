import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppLockGate } from '@/components/AppLockGate';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { TtsProvider } from '@/context/TtsContext';
import { Colors, Layout } from '@/constants/theme';
import { configureNotificationHandling } from '@/services/pushService';

configureNotificationHandling();

// Notification payloads carry web-app paths (e.g. "/flashcards?tab=review" from the
// backend's due-review push) — map them onto the closest RN route.
const routeForNotificationUrl = (url: string): string =>
  url.includes('flashcards') ? '/study/flashcards' : '/study';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasShareIntent } = useShareIntentContext();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(routeForNotificationUrl(url) as never);
    });
    return () => sub.remove();
  }, []);

  // A link/text shared into the app from the OS share sheet — hand off to the
  // dedicated intake screen (course picker + clip/save). Anonymous users just
  // keep the intent pending until they sign in; expo-share-intent clears it
  // automatically if the app is backgrounded first.
  useEffect(() => {
    if (hasShareIntent && isAuthenticated) {
      router.push('/share-intent');
    }
  }, [hasShareIntent, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ ...Layout.fillCenter, backgroundColor: Colors.bgApp }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <TtsProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="share-intent" options={{ headerShown: true, presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Share links are public (anonymous API) — viewable logged in or out. */}
        <Stack.Screen
          name="share/[token]"
          options={{
            headerShown: true,
            title: 'Shared',
            headerStyle: { backgroundColor: Colors.bgSidebar },
            headerTintColor: Colors.textPrimary,
          }}
        />
      </Stack>
    </TtsProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShareIntentProvider
        options={{
          resetOnBackground: true,
          onResetShareIntent: () => router.replace('/'),
        }}
      >
        <AppLockGate>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </AppLockGate>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}

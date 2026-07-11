import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppLockGate } from '@/components/AppLockGate';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { TtsProvider } from '@/context/TtsContext';
import { Colors } from '@/constants/theme';
import { configureNotificationHandling } from '@/services/pushService';

configureNotificationHandling();

// Notification payloads carry web-app paths (e.g. "/flashcards?tab=review" from the
// backend's due-review push) — map them onto the closest RN route.
const routeForNotificationUrl = (url: string): string =>
  url.includes('flashcards') ? '/study/flashcards' : '/study';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(routeForNotificationUrl(url) as never);
    });
    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp }}>
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
    <AppLockGate>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </AppLockGate>
  );
}

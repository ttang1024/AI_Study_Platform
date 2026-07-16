import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, Library, GraduationCap, Bot, Settings } from 'lucide-react-native';

import { AIProviderBanner } from '@/components/AIProviderBanner';
import { Colors, Shadows } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.bgSidebar,
            borderTopWidth: 0,
            // Shadows.card flipped upward for a bottom-anchored bar.
            ...Shadows.card,
            shadowOffset: { width: 0, height: -4 },
            elevation: 8,
          },
          tabBarLabelStyle: { fontWeight: '700' },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen
          name="home"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="library"
          options={{ title: 'Library', tabBarIcon: ({ color, size }) => <Library color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="study"
          options={{ title: 'Study', tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} /> }}
        />
        <Tabs.Screen name="summarizer" options={{ href: null }} />
        <Tabs.Screen
          name="chat"
          options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <Bot color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }}
        />
      </Tabs>
      <AIProviderBanner />
    </View>
  );
}

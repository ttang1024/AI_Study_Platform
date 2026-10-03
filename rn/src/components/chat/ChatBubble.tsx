import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Gradients, Radius, Shadows, Spacing } from '@/constants/theme';

interface ChatBubbleProps {
  /** Right-aligned brand-gradient bubble (the current user's messages). */
  self?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Shared by MessageBubble (AI chat), the streaming placeholder in ChatThreadView,
// and GroupChatView — the same left/right bubble shell with different content inside.
export const ChatBubble: React.FC<ChatBubbleProps> = ({ self, style, children }) =>
  self ? (
    <LinearGradient
      colors={Gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.bubble, styles.self, style]}
    >
      {children}
    </LinearGradient>
  ) : (
    <View style={[styles.bubble, styles.other, style]}>{children}</View>
  );

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: Radius.xl, padding: Spacing.three },
  self: { alignSelf: 'flex-end', borderBottomRightRadius: Radius.sm, ...Shadows.card },
  other: { alignSelf: 'flex-start', borderBottomLeftRadius: Radius.sm, backgroundColor: Colors.bgCard, ...Shadows.card },
});

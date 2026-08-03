import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Colors, Gradients, Layout, Radius, Shadows } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  /**
   * `danger` is an outlined red button, not a filled one: destructive actions here sit next to
   * ordinary ones in a settings list, and a filled red block would pull the eye harder than the
   * primary action on the same screen.
   */
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, variant = 'primary', disabled, loading }) => {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const inner = loading ? (
    <ActivityIndicator color={isPrimary ? Colors.primaryForeground : isDanger ? Colors.errorText : Colors.primary} />
  ) : (
    <Text
      style={[
        styles.text,
        isPrimary ? styles.textPrimary : isDanger ? styles.textDanger : styles.textSecondary,
      ]}
    >
      {title}
    </Text>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={isPrimary ? styles.primaryShadow : isDanger ? styles.danger : styles.secondary}
    >
      {isPrimary ? (
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.base}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: Radius.pill,
    ...Layout.center,
    paddingHorizontal: 20,
  },
  primaryShadow: {
    borderRadius: Radius.pill,
    ...Shadows.primaryGlow,
  },
  secondary: {
    height: 48,
    borderRadius: Radius.pill,
    ...Layout.center,
    paddingHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
  textPrimary: {
    color: Colors.primaryForeground,
  },
  textSecondary: {
    color: Colors.textPrimary,
  },
  danger: {
    height: 48,
    borderRadius: Radius.pill,
    ...Layout.center,
    paddingHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.errorText,
    ...Shadows.card,
  },
  textDanger: {
    color: Colors.errorText,
  },
});

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Colors, Gradients, Layout, Radius, Shadows } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, variant = 'primary', disabled, loading }) => {
  const isPrimary = variant === 'primary';
  const inner = loading ? (
    <ActivityIndicator color={isPrimary ? Colors.primaryForeground : Colors.primary} />
  ) : (
    <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>{title}</Text>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={isPrimary ? styles.primaryShadow : styles.secondary}
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
});

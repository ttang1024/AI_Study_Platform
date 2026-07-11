import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { DimensionValue, StyleSheet, View } from 'react-native';

import { Colors, Gradients, Radius } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0-1
  /** Flat fill color; when omitted the fill is the brand gradient. */
  color?: string;
  /** Gradient fill stops — takes precedence over `color`. */
  gradient?: readonly [string, string, ...string[]];
  trackColor?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  gradient,
  trackColor = Colors.zinc200,
  height = 8,
}) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const fillStyle = { width: `${clamped * 100}%` as DimensionValue, borderRadius: height / 2 };
  const stops = gradient ?? (color ? null : Gradients.primary);

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}>
      {stops ? (
        <LinearGradient colors={stops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, fillStyle]} />
      ) : (
        <View style={[styles.fill, fillStyle, { backgroundColor: color }]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: Radius.sm,
  },
  fill: {
    height: '100%',
  },
});

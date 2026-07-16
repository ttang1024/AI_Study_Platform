import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Gradients, Motion, Radius } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0-1
  /** Flat fill color; when omitted the fill is the brand gradient. */
  color?: string;
  /** Gradient fill stops — takes precedence over `color`. */
  gradient?: readonly [string, string, ...string[]];
  trackColor?: string;
  height?: number;
  /** Set false to paint the fill at its final width immediately (e.g. inside a
   *  list row, where a bar animating on every recycle is just noise). */
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  gradient,
  trackColor = Colors.zinc200,
  height = 8,
  animated = true,
}) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const stops = gradient ?? (color ? null : Gradients.primary);

  // Grows from empty on mount, then eases between values as progress updates —
  // the bar reads as filling up rather than as a static measurement.
  const fill = useSharedValue(animated ? 0 : clamped);

  useEffect(() => {
    fill.set(animated
      ? withTiming(clamped, { duration: Motion.duration.slow, easing: Easing.out(Easing.cubic) })
      : clamped);
  }, [clamped, animated, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, { borderRadius: height / 2 }, fillStyle]}>
        {stops ? (
          <LinearGradient
            colors={stops}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
        )}
      </Animated.View>
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
    overflow: 'hidden',
  },
});

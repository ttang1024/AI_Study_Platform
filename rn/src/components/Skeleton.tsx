import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pulsing placeholder block for skeleton loading states. Blocks mounted in the
 * same frame pulse in sync (each loop starts immediately with the same timing
 * curve), which covers the screen-level skeletons this app uses.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width, height = 14, radius = Radius.sm, style }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { width, height, borderRadius: radius, opacity }, style]} />;
};

const styles = StyleSheet.create({
  block: { backgroundColor: Colors.zinc200 },
});

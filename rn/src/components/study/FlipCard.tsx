import React, { useEffect } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

interface FlipCardProps {
  flipped: boolean;
  onPress: () => void;
  front: React.ReactNode;
  back: React.ReactNode;
  /** Applied to both faces, which are absolutely stacked — so this carries the
   *  card's surface styling (background, border, padding), not its position. */
  faceStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Two faces stacked in 3D, rotating about the Y axis.
 *
 * Both faces stay mounted and `backfaceVisibility: 'hidden'` decides which one
 * you see — swapping a single face's content at the halfway point instead would
 * mean re-measuring (and, for math cards, re-mounting a WebView) mid-rotation,
 * which shows up as a hitch exactly at the most visible frame of the animation.
 */
export const FlipCard: React.FC<FlipCardProps> = ({ flipped, onPress, front, back, faceStyle, style }) => {
  const spin = useSharedValue(flipped ? 1 : 0);

  useEffect(() => {
    spin.set(withSpring(flipped ? 1 : 0, Motion.spring.flip));
  }, [flipped, spin]);

  // `perspective` must come first in the transform list — without it the
  // rotation is an orthographic squash with no sense of depth.
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${spin.get() * 180}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${spin.get() * 180 + 180}deg` }],
  }));

  return (
    <Pressable style={[styles.root, style]} onPress={onPress}>
      <Animated.View style={[styles.face, faceStyle, frontStyle]}>{front}</Animated.View>
      <Animated.View style={[styles.face, faceStyle, backStyle]}>{back}</Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
});

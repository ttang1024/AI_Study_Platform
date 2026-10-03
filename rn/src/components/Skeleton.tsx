import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius } from '@/constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

const SHIMMER_DURATION = 1100;
/** Highlight width as a fraction of the block — a narrow band reads as a sweep. */
const HIGHLIGHT_RATIO = 0.6;

const SHIMMER_COLORS = [Colors.zinc200, Colors.zinc300, Colors.zinc200] as const;

/**
 * Placeholder block with a shimmer sweep for skeleton loading states.
 *
 * The sweep runs on the UI thread (Reanimated). That matters here more than
 * anywhere else in the app: skeletons are on screen precisely while JS is busy
 * fetching and parsing, which is when a JS-scheduled animation stutters.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width, height = 14, radius = Radius.sm, style }) => {
  // The sweep translates by a pixel offset, so it can't start until the block
  // has been measured. Until then this renders as a flat block, not a flash.
  const [blockWidth, setBlockWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (blockWidth === 0) return;
    progress.set(0);
    progress.set(withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    ));
  }, [blockWidth, progress]);

  const highlightWidth = blockWidth * HIGHLIGHT_RATIO;

  const sweepStyle = useAnimatedStyle(() => ({
    // Travels from fully off the left edge to fully off the right edge.
    transform: [{ translateX: -highlightWidth + progress.get() * (blockWidth + highlightWidth) }],
  }));

  return (
    <View
      onLayout={(e) => setBlockWidth(e.nativeEvent.layout.width)}
      style={[styles.block, { width, height, borderRadius: radius }, style]}
    >
      {blockWidth > 0 && (
        <Animated.View style={[styles.sweep, { width: highlightWidth }, sweepStyle]}>
          <LinearGradient
            colors={SHIMMER_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    backgroundColor: Colors.zinc200,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});

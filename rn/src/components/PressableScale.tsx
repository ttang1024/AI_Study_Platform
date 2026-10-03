import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedProps,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale to settle at while held. Lower it for large surfaces (a full-width
   *  card shrinking by the default 3% reads as a bigger jump than a chip does). */
  activeScale?: number;
  /** Fire a selection tick on press-in. Off by default — screens that already
   *  call `haptics.*` in their `onPress` would otherwise buzz twice. */
  haptic?: boolean;
  /** Reanimated entrance (e.g. `FadeInDown.delay(…)`). Exposed here so list rows
   *  can animate in without paying for an extra wrapper view around every row. */
  entering?: AnimatedProps<ViewProps>['entering'];
}

/**
 * Pressable with spring scale + dim feedback, replacing the hand-rolled
 * `style={({ pressed }) => [s.x, pressed && { opacity: 0.85 }]}` idiom that was
 * copy-pasted across the app.
 *
 * The animation is driven by Reanimated shared values on the UI thread, so the
 * press still responds while JS is blocked (a list fetch, an AI stream) — the
 * `pressed` callback form re-renders on the JS thread and visibly stalls there.
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  style,
  activeScale = Motion.pressScale,
  haptic,
  entering,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - (1 - activeScale) * pressed.get(), Motion.spring.press) }],
    opacity: withTiming(1 - 0.12 * pressed.get(), { duration: Motion.duration.instant }),
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>((e) => {
    pressed.set(1);
    if (haptic) haptics.tap();
    onPressIn?.(e);
  }, [pressed, haptic, onPressIn]);

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>((e) => {
    pressed.set(0);
    onPressOut?.(e);
  }, [pressed, onPressOut]);

  const pressable = (
    <AnimatedPressable
      style={[style, animatedStyle, !!disabled && { opacity: 0.5 }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );

  // Reanimated overwrites `opacity`/`transform` when a layout animation shares a
  // component with an animated style, so the entrance rides an outer wrapper
  // while the press scale stays on the Pressable. The wrapper is only rendered
  // when an entrance is requested — press-only usages pay for no extra view.
  if (!entering) return pressable;

  return <Animated.View entering={entering}>{pressable}</Animated.View>;
};

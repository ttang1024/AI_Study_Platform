import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Motion, Radius, Spacing, Typography } from '@/constants/theme';

export type QuizOptionState = 'idle' | 'selected' | 'correct' | 'wrong';

interface QuizOptionProps {
  label: string;
  state: QuizOptionState;
  onPress: () => void;
  disabled?: boolean;
  /** Position within the question — staggers the post-submit reveal. */
  index: number;
}

// Fully-transparent brand emerald rather than `transparent`: Reanimated
// interpolates colors through RGBA, and animating from `transparent`
// (rgba(0,0,0,0)) drags every transition through a grey cast on the way out.
const IDLE_BG = `${Colors.primary}00`;

const BACKGROUND: Record<QuizOptionState, string> = {
  idle: IDLE_BG,
  selected: `${Colors.primary}${Alpha.wash}`,
  correct: `${Colors.emerald}${Alpha.tint}`,
  wrong: `${Colors.red}${Alpha.tint}`,
};

const BORDER: Record<QuizOptionState, string> = {
  idle: Colors.border,
  selected: Colors.primary,
  correct: Colors.emerald,
  wrong: Colors.red,
};

/**
 * A single multiple-choice answer.
 *
 * Picking one eases its fill/border in rather than hard-swapping the style, and
 * on submit the graded states cascade down the question so the result reads as
 * a reveal. The correct answer also gets a small pop — after a wrong pick, the
 * eye needs to be pulled to the right answer, not just to the red one.
 */
export const QuizOption: React.FC<QuizOptionProps> = ({ label, state, onPress, disabled, index }) => {
  const pop = useSharedValue(1);
  const graded = state === 'correct' || state === 'wrong';
  const revealDelay = graded ? Motion.stagger(index, 60) : 0;

  useEffect(() => {
    if (state !== 'correct') return;
    pop.set(withDelay(
      revealDelay,
      withSequence(
        withSpring(1.03, Motion.spring.bouncy),
        withSpring(1, Motion.spring.bouncy),
      ),
    ));
  }, [state, revealDelay, pop]);

  const animatedStyle = useAnimatedStyle(() => {
    const timing = { duration: Motion.duration.base };
    return {
      backgroundColor: withDelay(revealDelay, withTiming(BACKGROUND[state], timing)),
      borderColor: withDelay(revealDelay, withTiming(BORDER[state], timing)),
      transform: [{ scale: pop.get() }],
    };
  });

  return (
    <PressableScale style={styles.option} onPress={onPress} disabled={disabled}>
      <Animated.View style={[styles.fill, animatedStyle]} />
      <Text style={styles.text}>{label}</Text>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  option: {
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  // The animated fill sits behind the label as an absolute layer, so the
  // Pressable itself keeps a static size — animating the border on the
  // Pressable directly would relayout the text on every state change.
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  text: { ...Typography.body, color: Colors.textPrimary },
});

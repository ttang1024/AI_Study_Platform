import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';

import { Motion } from '@/constants/theme';

interface AnimatedNumberProps extends TextProps {
  value: number;
  /** Wraps the counted value, e.g. `(n) => \`${n}m\`` or `(n) => \`${n}%\``. */
  format?: (value: number) => string;
  duration?: number;
}

// Ease-out: most of the distance is covered early, so the number lands rather
// than creeps. Matches the feel of the spring presets used elsewhere.
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts up to `value` on mount and on change.
 *
 * Unlike the rest of the motion in this app this is driven from JS, not
 * Reanimated: animating *text content* on the UI thread means swapping the
 * `Text` for a non-editable `TextInput` and pushing its native `text` prop,
 * which screen readers then announce as an editable field. The state lives
 * inside this component, so a tick re-renders only the one number — the
 * accessibility cost of the UI-thread version isn't worth saving that.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = String,
  duration = Motion.duration.slow * 2,
  ...rest
}) => {
  const [display, setDisplay] = useState(value);
  // Count from wherever the last animation left off, so a value that changes
  // mid-flight (a refetch) continues rather than snapping back to zero.
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const next = from + (value - from) * easeOut(t);
      setDisplay(next);
      fromRef.current = next;
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        setDisplay(value);
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return <Text {...rest}>{format(Math.round(display))}</Text>;
};

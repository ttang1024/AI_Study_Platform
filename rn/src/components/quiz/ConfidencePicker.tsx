import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

// Mirrors web/src/components/quiz/ConfidencePicker.tsx.

/** 1 = guessing, 2 = unsure, 3 = confident. Matches ConfidenceLevel on the server. */
export const CONFIDENCE_LEVELS = [
  { level: 1, label: 'Guessing' },
  { level: 2, label: 'Unsure' },
  { level: 3, label: 'Confident' },
] as const;

interface ConfidencePickerProps {
  value: number | undefined;
  onChange: (level: number) => void;
}

/**
 * Asks how sure the learner is, before they find out whether they were right.
 *
 * Three coarse levels rather than a percentage: asking for a number makes people deliberate about the
 * number instead of the question. Rating is optional — a skipped question is recorded as no data, not
 * as a low rating, which would be a lie.
 */
export const ConfidencePicker: React.FC<ConfidencePickerProps> = ({ value, onChange }) => (
  <View style={styles.root}>
    <Text style={styles.prompt}>How sure are you?</Text>
    <View style={styles.chips}>
      {CONFIDENCE_LEVELS.map(({ level, label }) => {
        const selected = value === level;
        return (
          <Pressable
            key={level}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => {
              haptics.tap();
              onChange(level);
            }}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { gap: Spacing.one, marginTop: Spacing.one },
  prompt: { ...Typography.caption, color: Colors.textSecondary },
  chips: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.caption, color: Colors.textSecondary },
  chipTextSelected: { color: Colors.white, fontWeight: '600' },
});

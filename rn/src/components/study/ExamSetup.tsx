import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

const TIME_PRESETS = [5, 10, 15, 20, 30, 60];

interface ExamSetupProps {
  title: string;
  questionCount: number;
  minutes: number;
  onChangeMinutes: (minutes: number) => void;
  onStart: () => void;
}

export const ExamSetup: React.FC<ExamSetupProps> = ({ title, questionCount, minutes, onChangeMinutes, onStart }) => (
  <View style={styles.root}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{questionCount} question{questionCount === 1 ? '' : 's'}</Text>

    <Text style={styles.sectionLabel}>Time limit</Text>
    <View style={styles.presetRow}>
      {TIME_PRESETS.map((m) => (
        <Pressable key={m} style={[styles.preset, minutes === m && styles.presetActive]} onPress={() => onChangeMinutes(m)}>
          <Text style={[styles.presetText, minutes === m && styles.presetTextActive]}>{m}m</Text>
        </Pressable>
      ))}
    </View>

    <Button title="Start Exam" onPress={onStart} />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three, gap: Spacing.three },
  title: { ...Typography.heading, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, marginTop: Spacing.two },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  preset: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  presetActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presetText: { ...Typography.captionBold, color: Colors.textSecondary },
  presetTextActive: { color: Colors.primaryForeground },
});

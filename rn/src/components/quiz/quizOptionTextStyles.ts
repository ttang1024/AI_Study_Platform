import { StyleSheet } from 'react-native';

import { Colors, Typography } from '@/constants/theme';

// Shared by MistakesTab and QuestionBankTab's read-only option review text —
// distinct from QuizRunner's interactive bordered option buttons.
export const quizOptionTextStyles = StyleSheet.create({
  option: { ...Typography.caption, color: Colors.textSecondary, paddingVertical: 2 },
  optionCorrect: { color: Colors.emerald, fontWeight: '700' },
  optionWrong: { color: Colors.red, fontWeight: '700' },
});

import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { CodeCell } from '@/components/study/CodeCell';
import { Colors, Spacing, Typography } from '@/constants/theme';

const STARTER_CODE = `# A worked example. Edit it and press Run.
def fizzbuzz(n):
    if n % 15 == 0:
        return "FizzBuzz"
    if n % 3 == 0:
        return "Fizz"
    if n % 5 == 0:
        return "Buzz"
    return str(n)


for i in range(1, 16):
    print(fizzbuzz(i))
`;

const STARTER_TESTS = `assert fizzbuzz(3) == "Fizz"
assert fizzbuzz(5) == "Buzz"
assert fizzbuzz(15) == "FizzBuzz"
assert fizzbuzz(7) == "7"
print("checks passed")
`;

export default function CodeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.caption}>
        Python runs on your device — nothing you write here is sent anywhere. The first run downloads
        the interpreter, so it takes a few seconds; later runs are instant.
      </Text>

      <CodeCell prompt="Make all four checks pass." initialCode={STARTER_CODE} tests={STARTER_TESTS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  caption: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 19 },
});

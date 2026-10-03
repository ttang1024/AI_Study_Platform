import { ScrollView, StyleSheet } from 'react-native';

import { StudyCalendar } from '@/components/study/StudyCalendar';
import { Colors, Spacing } from '@/constants/theme';

export default function StudyCalendarScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <StudyCalendar />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
});

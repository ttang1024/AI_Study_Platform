import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SegmentedTabs } from '@/components/SegmentedTabs';
import { HistoryTab } from '@/components/quiz/HistoryTab';
import { MistakesTab } from '@/components/quiz/MistakesTab';
import { QuestionBankTab } from '@/components/quiz/QuestionBankTab';
import { Colors, Spacing } from '@/constants/theme';

type Tab = 'bank' | 'mistakes' | 'history';

export default function QuizzesScreen() {
  const [tab, setTab] = useState<Tab>('bank');

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'bank', label: 'Question Bank' },
            { value: 'mistakes', label: 'Mistakes' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>
      {tab === 'bank' && <QuestionBankTab />}
      {tab === 'mistakes' && <MistakesTab />}
      {tab === 'history' && <HistoryTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  tabs: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
});

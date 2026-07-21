import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

import { TabChipRow } from '@/components/TabChipRow';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { useSharedContent, type SharedTab } from '@/hooks/useSharedContent';
import { SharedContentHeader } from '@/components/share/SharedContentHeader';
import { SharedContentMedia } from '@/components/share/SharedContentMedia';
import { SharedContentBody } from '@/components/share/SharedContentBody';

export default function SharedContentScreen() {
  const { content, error, tab, setTab, mindMapHtml, sourceType, tabs, createdAt, youTubeId, chatMessages } = useSharedContent();

  if (error) {
    return (
      <View style={styles.center}>
        <AlertCircle size={32} color={Colors.red} />
        <Text style={styles.errorTitle}>Content not found</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!content) {
    return <ActivityIndicator style={styles.center} color={Colors.primary} />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SharedContentHeader content={content} sourceType={sourceType} createdAt={createdAt} />

      <SharedContentMedia content={content} sourceType={sourceType} youTubeId={youTubeId} />

      {tabs.length > 1 && (
        <TabChipRow tabs={tabs} active={tab ?? tabs[0].id} onChange={(next: SharedTab) => setTab(next)} />
      )}

      <SharedContentBody tab={tab} content={content} sourceType={sourceType} mindMapHtml={mindMapHtml} chatMessages={chatMessages} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp, gap: Spacing.two, padding: Spacing.five },
  errorTitle: { ...Typography.heading, color: Colors.textPrimary },
  errorText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
});

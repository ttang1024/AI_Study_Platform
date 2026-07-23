import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';
import X from 'lucide-react-native/icons/x';

import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { PendingAttachment } from '@/hooks/useChatAttachments';

interface StagingAttachmentsRowProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

// Memoized because it lives above the composer: typing re-renders the thread on every
// keystroke, and both props (`attachments` state, `onRemove` callback) are already stable.
export const StagingAttachmentsRow: React.FC<StagingAttachmentsRowProps> = React.memo(
  function StagingAttachmentsRow({ attachments, onRemove }) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {attachments.map((a) => (
          <View key={a.id} style={styles.item}>
            {a.isImage ? (
              <Image source={{ uri: a.previewUri }} style={styles.thumb} />
            ) : (
              <View style={styles.file}>
                <FileText size={18} color={Colors.primary} />
                <Text style={styles.fileText} numberOfLines={2}>{a.fileName}</Text>
              </View>
            )}
            <Pressable style={styles.remove} onPress={() => onRemove(a.id)} hitSlop={6}>
              <X size={11} color={Colors.white} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    );
  },
);

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two, backgroundColor: Colors.bgSidebar },
  item: { width: 64, height: 64 },
  thumb: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.zinc200 },
  file: {
    width: 64, height: 64, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgApp, ...Layout.center, padding: 4, gap: 2,
  },
  fileText: { ...Typography.caption, fontSize: 8, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  remove: {
    position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.textPrimary, ...Layout.center,
  },
});

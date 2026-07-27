import { Pressable, StyleSheet, Text, View } from 'react-native';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import FileText from 'lucide-react-native/icons/file-text';
import Share2 from 'lucide-react-native/icons/share-2';

import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { DocumentAudioPlayer } from '@/components/library/DocumentAudioPlayer';
import { FilePreview } from '@/components/library/FilePreview';
import { formatUploadDate, TYPE_ICON } from '@/components/library/documentDetailMeta';
import type { Document } from '@/types';

interface Props {
  doc: Document;
  downloadUrl: string | null;
  showPreview: boolean;
  onTogglePreview: () => void;
  onOpenShare: () => void;
}

export function DocumentDetailHeader({ doc, downloadUrl, showPreview, onTogglePreview, onOpenShare }: Props) {
  const isAudio = doc.type === 'audio' || doc.type === 'podcast';
  const TypeIcon = TYPE_ICON[doc.type] ?? FileText;
  const uploadDate = formatUploadDate(doc.uploadDate);

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.typeIcon}>
          <TypeIcon size={20} color={Colors.primary} />
        </View>
        <View style={styles.titleTextGroup}>
          <Text style={styles.title} numberOfLines={2}>{doc.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{doc.type}</Text>
            </View>
            {!!doc.courseName && <Text style={styles.metaText} numberOfLines={1}>{doc.courseName}</Text>}
            {!!uploadDate && <Text style={styles.metaText}>· {uploadDate}</Text>}
          </View>
        </View>
        <Pressable style={styles.shareButton} onPress={onOpenShare} accessibilityLabel="Share this document">
          <Share2 size={18} color={Colors.primary} />
        </Pressable>
      </View>

      {isAudio && downloadUrl && <DocumentAudioPlayer url={downloadUrl} />}

      {!isAudio && (
        <Pressable
          style={styles.openButton}
          disabled={!downloadUrl}
          onPress={onTogglePreview}
        >
          {showPreview ? <EyeOff size={16} color={Colors.primary} /> : <Eye size={16} color={Colors.primary} />}
          <Text style={styles.openButtonText}>{showPreview ? 'Hide preview' : 'Preview file'}</Text>
        </Pressable>
      )}

      {!isAudio && showPreview && downloadUrl && <FilePreview url={downloadUrl} type={doc.type} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  titleRow: { flexDirection: 'row', gap: Spacing.two },
  typeIcon: {
    width: 40, height: 40, borderRadius: Radius.md, backgroundColor: `${Colors.primary}${Alpha.tint}`,
    ...Layout.center,
  },
  titleTextGroup: { flex: 1, gap: 4 },
  shareButton: {
    width: 36, height: 36, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgSidebar, ...Layout.center,
  },
  title: { ...Typography.screenTitle, color: Colors.textPrimary },
  metaRow: { ...Layout.rowWrap, gap: 6 },
  typeBadge: {
    backgroundColor: `${Colors.primary}${Alpha.tint}`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  openButton: {
    ...Layout.row, justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, height: 44, backgroundColor: Colors.bgSidebar,
  },
  openButtonText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});

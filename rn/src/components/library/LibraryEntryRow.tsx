import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FadeInDown } from 'react-native-reanimated';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import BookOpen from 'lucide-react-native/icons/book-open';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import FileImage from 'lucide-react-native/icons/file-image';
import FileText from 'lucide-react-native/icons/file-text';
import Headphones from 'lucide-react-native/icons/headphones';
import Newspaper from 'lucide-react-native/icons/newspaper';
import Play from 'lucide-react-native/icons/play';
import Presentation from 'lucide-react-native/icons/presentation';
import Check from 'lucide-react-native/icons/check';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import TagIcon from 'lucide-react-native/icons/tag';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Video from 'lucide-react-native/icons/video';
import type { LucideIcon } from 'lucide-react-native';

import { IconBadge } from '@/components/IconBadge';
import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Layout, Motion, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import type { LibraryEntry } from '@/services/libraryService';
import type { Document } from '@/types';
import { documentSourceKind } from '@core/utils/documentDisplay';
import { haptics } from '@/utils/haptics';

interface EntryLook {
  icon: LucideIcon;
  color: string;
  label: string;
}

const DOC_LOOKS: Record<Document['type'], EntryLook> = {
  pdf: { icon: FileText, color: Colors.red, label: 'PDF' },
  docx: { icon: FileText, color: Colors.blue, label: 'DOCX' },
  txt: { icon: FileText, color: Colors.primary, label: 'Text' },
  md: { icon: FileText, color: Colors.primary, label: 'Markdown' },
  audio: { icon: Headphones, color: Colors.purple, label: 'Audio' },
  podcast: { icon: Headphones, color: Colors.purple, label: 'Podcast' },
  image: { icon: FileImage, color: Colors.teal, label: 'Image' },
  ppt: { icon: Presentation, color: Colors.orange, label: 'Slides' },
  epub: { icon: BookOpen, color: Colors.amber, label: 'EPUB' },
};

const lookFor = (entry: LibraryEntry): EntryLook => {
  if (entry.kind === 'video') return { icon: Video, color: Colors.red, label: 'Video' };
  const doc = entry.data;
  // documentSourceKind already puts podcasts (which carry an originalUrl too) under 'audio',
  // so only a genuine clipped article reaches the Newspaper look.
  if (documentSourceKind(doc) === 'article') {
    return { icon: Newspaper, color: Colors.blue, label: 'Article' };
  }
  return DOC_LOOKS[doc.type];
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
};

interface LibraryEntryRowProps {
  entry: LibraryEntry;
  onPress: (entry: LibraryEntry) => void;
  /** When provided, the row can be swiped left to reveal a Delete action. */
  onDelete?: (entry: LibraryEntry) => void;
  /** Position in the list — drives the entrance stagger. */
  index?: number;
  /** Toggles the row's membership in the bulk-tagging selection. Long-press starts it; while
   *  a selection is active a plain tap toggles too. */
  onToggleSelect?: (entry: LibraryEntry) => void;
  /** True while any row is selected: tapping toggles instead of opening. */
  selectionMode?: boolean;
  selected?: boolean;
}

export const LibraryEntryRow: React.FC<LibraryEntryRowProps> = React.memo(function LibraryEntryRow({
  entry, onPress, onDelete, index = 0, onToggleSelect, selectionMode = false, selected = false,
}) {
  const look = lookFor(entry);
  const title = entry.kind === 'document' ? entry.data.name : entry.data.title;
  const courseName = entry.data.courseName;
  const courseColor = entry.data.courseColor;
  const date = formatDate(entry.kind === 'document' ? entry.data.uploadDate : entry.data.createdAt);
  const thumbnailUrl = entry.kind === 'video' ? entry.data.thumbnailUrl : '';

  const renderRightActions = useCallback(
    (_progress: unknown, _translation: unknown, methods: SwipeableMethods) => (
      <Pressable
        style={styles.deleteAction}
        onPress={() => { methods.close(); onDelete?.(entry); }}
        accessibilityLabel={`Delete ${title}`}
      >
        <Trash2 size={20} color={Colors.white} />
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    ),
    [entry, onDelete, title],
  );

  const card = (
    <PressableScale
      style={[styles.card, selected && styles.cardSelected]}
      onPress={() => (selectionMode ? onToggleSelect?.(entry) : onPress(entry))}
      onLongPress={onToggleSelect ? () => { haptics.tap(); onToggleSelect(entry); } : undefined}
      // Rows slide in as the page lands. `Motion.stagger` caps the delay, so an
      // appended page (index 20+) fades in promptly rather than after a
      // second-long queue of per-item offsets.
      entering={FadeInDown.delay(Motion.stagger(index, 35)).duration(Motion.duration.base)}
    >
      {thumbnailUrl ? (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: thumbnailUrl }} style={styles.thumb} contentFit="cover" cachePolicy="disk" transition={150} />
          <View style={styles.playBadge}>
            <Play size={11} color={Colors.white} fill={Colors.white} />
          </View>
        </View>
      ) : (
        <IconBadge icon={look.icon} color={look.color} size={44} iconSize={20} />
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.typePill, { backgroundColor: `${look.color}${Alpha.tint}` }]}>
            <Text style={[styles.typePillText, { color: look.color }]}>{look.label}</Text>
          </View>
          {!!courseName && (
            <View style={styles.courseWrap}>
              <View style={[styles.courseDot, { backgroundColor: courseColor || Colors.primary }]} />
              <Text style={styles.metaText} numberOfLines={1}>{courseName}</Text>
            </View>
          )}
          {!!date && <Text style={styles.metaText}>{date}</Text>}
        </View>
        {entry.tags.length > 0 && (
          <View style={styles.tagRow}>
            {entry.tags.map((tag) => (
              <View
                key={tag.libraryTagId}
                style={[styles.tagChip, !!tag.color && { borderColor: `${tag.color}66` }]}
              >
                {tag.kind === 'collection'
                  ? <FolderOpen size={9} color={tag.color || Colors.textSecondary} />
                  : <TagIcon size={9} color={tag.color || Colors.textSecondary} />}
                <Text style={[styles.tagText, !!tag.color && { color: tag.color }]} numberOfLines={1}>
                  {tag.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {selectionMode ? (
        <View style={[styles.checkCircle, selected && styles.checkCircleOn]}>
          {selected && <Check size={13} color={Colors.primaryForeground} />}
        </View>
      ) : (
        <ChevronRight size={16} color={Colors.zinc300} />
      )}
    </PressableScale>
  );

  // Swipe-to-delete is suppressed in selection mode: a horizontal drag there reads as an attempt
  // to pick rows, and a delete confirm on top of a multi-selection is a trap.
  if (!onDelete || selectionMode) return card;

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      containerStyle={styles.swipeContainer}
    >
      {card}
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  // Rounded to match the card so the revealed action tucks under the row's corners.
  swipeContainer: { borderRadius: Radius.lg },
  deleteAction: {
    ...Layout.center,
    gap: 4,
    width: 92,
    marginLeft: Spacing.two,
    backgroundColor: Colors.red,
    borderRadius: Radius.lg,
  },
  deleteText: { fontSize: 12, fontWeight: '800', color: Colors.white },
  card: {
    ...Layout.row,
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    ...Shadows.card,
  },
  cardSelected: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.tint}` },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border,
    ...Layout.center,
  },
  checkCircleOn: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  thumbWrap: {
    width: 88,
    height: 52,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.zinc200,
    ...Layout.center,
  },
  thumb: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  playBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Overlay.backdrop,
    ...Layout.center,
    // Optically center the triangular glyph.
    paddingLeft: 2,
  },
  body: { flex: 1, gap: 6 },
  title: { ...Typography.bodyBold, fontSize: 14, lineHeight: 19, color: Colors.textPrimary },
  metaRow: { ...Layout.row, gap: Spacing.two },
  typePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  typePillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  courseWrap: { ...Layout.row, gap: 5, flexShrink: 1 },
  courseDot: { width: 6, height: 6, borderRadius: 3 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  tagRow: { ...Layout.row, gap: Spacing.one, flexWrap: 'wrap' },
  tagChip: {
    ...Layout.row, gap: 3,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  tagText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, maxWidth: 110 },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Check from 'lucide-react-native/icons/check';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import Tag from 'lucide-react-native/icons/tag';
import X from 'lucide-react-native/icons/x';

import { Alpha, Colors, Layout, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  libraryTagsService, type LibraryItemRef, type LibraryTag, type LibraryTagKind,
} from '@/services/libraryTagsService';

/** One entry of the current selection: how to address it, and what it already carries. */
export interface AssignSelectionItem {
  ref: LibraryItemRef;
  tagIds: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  selection: AssignSelectionItem[];
  /** Fired after a successful assign/unassign so the list can refetch. */
  onChanged: (message: string) => void;
}

/**
 * Mobile counterpart of web's LibraryAssignMenu: add the selected library items to a collection
 * or tag. A row toggles — if every selected item already carries the tag the tap removes it,
 * otherwise it adds it to the ones missing it.
 */
export const LibraryAssignSheet: React.FC<Props> = ({ visible, onClose, selection, onChanged }) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<LibraryTagKind>('collection');
  const [creating, setCreating] = useState(false);
  // Bumped after an assign so the item counts refetch. Kept separate from `visible` so both
  // reasons to load flow through one effect.
  const [reloadKey, setReloadKey] = useState(0);
  const [tags, setTags] = useState<LibraryTag[] | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Loaded when the sheet opens, and again after each assign — the counts move as the user files
  // things. State is only set from the promise callbacks: setting it in the effect body itself is
  // a cascading render (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    libraryTagsService.getTags()
      .then((res) => { if (!cancelled) setTags(res.data.data); })
      .catch(() => {
        if (cancelled) return;
        setTags([]);
        setError('Could not load your collections.');
      });
    return () => { cancelled = true; };
  }, [visible, reloadKey]);

  // The previous list stays on screen while a reload is in flight, so filing an item doesn't
  // flash the whole sheet back to a spinner.
  const loading = tags === null;

  const refs = selection.map((s) => s.ref);

  const toggleTag = async (tag: LibraryTag) => {
    const applied = selection.filter((s) => s.tagIds.includes(tag.libraryTagId));
    const removing = applied.length === selection.length;
    const targets = removing
      ? refs
      : selection.filter((s) => !s.tagIds.includes(tag.libraryTagId)).map((s) => s.ref);

    setBusyId(tag.libraryTagId);
    setError(null);
    try {
      const res = removing
        ? await libraryTagsService.unassignItems(tag.libraryTagId, targets)
        : await libraryTagsService.assignItems(tag.libraryTagId, targets);
      onChanged(res.data.message);
      reload();
    } catch {
      setError('Could not update that.');
    } finally {
      setBusyId(null);
    }
  };

  const createAndAssign = async () => {
    const name = draftName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const created = await libraryTagsService.createTag({ name, kind: draftKind });
      const res = await libraryTagsService.assignItems(created.data.data.libraryTagId, refs);
      setDraftName('');
      onChanged(res.data.message);
      reload();
    } catch {
      setError('Could not create that.');
    } finally {
      setCreating(false);
    }
  };

  const collections = tags?.filter((t) => t.kind === 'collection') ?? [];
  const plainTags = tags?.filter((t) => t.kind === 'tag') ?? [];

  const renderRow = (tag: LibraryTag) => {
    const applied = selection.filter((s) => s.tagIds.includes(tag.libraryTagId)).length;
    const state = applied === 0 ? 'none' : applied === selection.length ? 'all' : 'some';
    const Icon = tag.kind === 'collection' ? FolderOpen : Tag;
    return (
      <Pressable
        key={tag.libraryTagId}
        style={[styles.row, state !== 'none' && styles.rowOn]}
        disabled={busyId !== null}
        onPress={() => toggleTag(tag)}
      >
        <View style={[styles.box, state === 'all' && styles.boxOn, state === 'some' && styles.boxPartial]}>
          {busyId === tag.libraryTagId ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : state === 'all' ? (
            <Check size={11} color={Colors.primaryForeground} />
          ) : state === 'some' ? (
            <Minus size={11} color={Colors.primary} />
          ) : null}
        </View>
        <Icon size={13} color={Colors.textSecondary} />
        <Text style={styles.rowLabel} numberOfLines={1}>{tag.name}</Text>
        <Text style={styles.rowCount}>{tag.itemCount}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <FolderOpen size={16} color={Colors.primary} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                Add {selection.length} {selection.length === 1 ? 'item' : 'items'} to…
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loading} />
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {tags?.length === 0 && (
                <Text style={styles.emptyText}>
                  No collections or tags yet — create one below.
                </Text>
              )}
              {collections.length > 0 && <Text style={styles.sectionLabel}>Collections</Text>}
              {collections.map(renderRow)}
              {plainTags.length > 0 && <Text style={styles.sectionLabel}>Tags</Text>}
              {plainTags.map(renderRow)}
            </ScrollView>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.createRow}>
            <Pressable
              style={styles.kindToggle}
              onPress={() => setDraftKind((k) => (k === 'collection' ? 'tag' : 'collection'))}
            >
              {draftKind === 'collection'
                ? <FolderOpen size={13} color={Colors.primary} />
                : <Tag size={13} color={Colors.primary} />}
              <Text style={styles.kindToggleText}>
                {draftKind === 'collection' ? 'Collection' : 'Tag'}
              </Text>
            </Pressable>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="New name…"
              placeholderTextColor={Colors.textSecondary}
              style={styles.input}
              onSubmitEditing={createAndAssign}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.createButton, (!draftName.trim() || creating) && styles.createButtonOff]}
              disabled={!draftName.trim() || creating}
              onPress={createAndAssign}
            >
              {creating
                ? <ActivityIndicator size="small" color={Colors.primaryForeground} />
                : <Plus size={14} color={Colors.primaryForeground} />}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Overlay.backdrop },
  sheetWrap: { flex: 1, justifyContent: 'center', padding: Spacing.three },
  sheet: {
    backgroundColor: Colors.bgSidebar, borderRadius: Radius.xl, padding: Spacing.three,
    gap: Spacing.two, ...Shadows.card,
  },
  headerRow: { ...Layout.rowBetween, gap: Spacing.two },
  headerTitleGroup: { ...Layout.row, gap: Spacing.two, flex: 1 },
  headerTitle: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  // Capped so a long tag list scrolls inside the sheet instead of pushing the create row off.
  list: { maxHeight: 280 },
  listContent: { gap: Spacing.one },
  loading: { paddingVertical: Spacing.four },
  sectionLabel: {
    ...Typography.captionBold, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: Spacing.two,
  },
  row: {
    ...Layout.row, gap: Spacing.two,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three, paddingVertical: 10, backgroundColor: Colors.bgCard,
  },
  rowOn: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.tint}` },
  box: {
    width: 18, height: 18, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.border,
    ...Layout.center,
  },
  boxOn: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  boxPartial: { borderColor: Colors.primary },
  rowLabel: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  rowCount: { ...Typography.caption, color: Colors.textSecondary },
  emptyText: { ...Typography.caption, color: Colors.textSecondary, paddingVertical: Spacing.two },
  errorText: { ...Typography.caption, color: Colors.red },
  createRow: { ...Layout.row, gap: Spacing.two, marginTop: Spacing.one },
  kindToggle: {
    ...Layout.row, gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: 8, backgroundColor: Colors.bgCard,
  },
  kindToggleText: { ...Typography.captionBold, color: Colors.primary },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: 8,
    color: Colors.textPrimary, backgroundColor: Colors.bgCard, fontSize: 13,
  },
  createButton: {
    width: 36, borderRadius: Radius.md, backgroundColor: Colors.primary, ...Layout.center,
  },
  createButtonOff: { opacity: 0.4 },
});

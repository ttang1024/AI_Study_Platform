import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Brain from 'lucide-react-native/icons/brain';
import Check from 'lucide-react-native/icons/check';
import Pencil from 'lucide-react-native/icons/pencil';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Sparkles from 'lucide-react-native/icons/sparkles';
import X from 'lucide-react-native/icons/x';
import ZoomIn from 'lucide-react-native/icons/zoom-in';
import ZoomOut from 'lucide-react-native/icons/zoom-out';

import { EmptyState } from '@/components/EmptyState';
import { Alpha, Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import { documentService } from '@/services/documentService';
import { buildMindMapHtml } from '@/utils/mindMapHtml';
import { xmindMarkToMarkdown } from '@/utils/xmindMarkdown';
import type { Document } from '@/types';

interface MindMapViewProps {
  document: Document;
  courseId: string;
  onDocumentUpdate: (doc: Document) => void;
}

export function MindMapView({ document, courseId, onDocumentUpdate }: MindMapViewProps) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const streamAccumRef = useRef('');

  const mindMapText = document.mindMapText ?? null;
  const html = useMemo(
    () => (mindMapText ? buildMindMapHtml(xmindMarkToMarkdown(mindMapText)) : null),
    [mindMapText],
  );

  const runGenerate = async () => {
    setGenerating(true);
    setGenError(false);
    setRenderError(null);
    streamAccumRef.current = '';
    try {
      await documentService.streamMindMap(courseId, document.id, (chunk) => {
        streamAccumRef.current += chunk;
      });
      if (streamAccumRef.current) {
        onDocumentUpdate({ ...document, mindMapText: streamAccumRef.current });
      } else {
        setGenError(true);
      }
    } catch {
      setGenError(true);
    } finally {
      setGenerating(false);
    }
  };

  const startEditing = () => {
    setEditDraft(mindMapText ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await documentService.updateMindMap(courseId, document.id, editDraft);
      onDocumentUpdate(updated);
      setEditing(false);
    } catch {
      // keep the editor open so the draft isn't lost
    } finally {
      setSaving(false);
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(e.nativeEvent.data);
      if (payload.type === 'error') setRenderError(payload.message);
      if (payload.type === 'ready') setRenderError(null);
    } catch {
      // ignore malformed messages
    }
  };

  if (generating && !mindMapText) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.centerStateText}>Generating mind map…</Text>
      </View>
    );
  }

  if (!mindMapText) {
    return (
      <EmptyState
        icon={Brain}
        title="No Mind Map Yet"
        subtitle={genError ? 'Couldn’t generate a mind map. Try again.' : 'Generate a visual mind map of this document.'}
        action={{ label: 'Generate Mind Map', onPress: runGenerate }}
        bordered
      />
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        key={mindMapText}
        ref={webviewRef}
        source={{ html: html! }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
      />

      {renderError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Couldn&apos;t render mind map</Text>
        </View>
      )}

      {generating && (
        <View style={styles.regeneratingBadge}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.regeneratingText}>Regenerating…</Text>
        </View>
      )}

      <View style={styles.controls}>
        <Pressable style={styles.ctrlBtn} onPress={() => webviewRef.current?.injectJavaScript('window.mmFit && window.mmFit(); true;')}>
          <RotateCcw size={16} color={Colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={() => webviewRef.current?.injectJavaScript('window.mmZoomBy && window.mmZoomBy(1.25); true;')}>
          <ZoomIn size={16} color={Colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={() => webviewRef.current?.injectJavaScript('window.mmZoomBy && window.mmZoomBy(0.8); true;')}>
          <ZoomOut size={16} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.ctrlDivider} />
        <Pressable style={styles.ctrlBtn} onPress={startEditing}>
          <Pencil size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <Pressable style={styles.regenerateButton} onPress={runGenerate} disabled={generating}>
        <Sparkles size={13} color={Colors.primary} />
        <Text style={styles.regenerateButtonText}>Regenerate</Text>
      </Pressable>

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={styles.editModal}>
          <Text style={styles.editLabel}>Edit mind map — one root line, then indented &quot;-&quot; bullets</Text>
          <TextInput
            style={styles.editInput}
            value={editDraft}
            onChangeText={setEditDraft}
            multiline
            autoFocus
            placeholder={'Root topic\n  - Branch\n    - Sub-branch'}
          />
          <View style={styles.editActions}>
            <Pressable style={styles.editCancelButton} onPress={() => setEditing(false)} disabled={saving}>
              <X size={14} color={Colors.textSecondary} />
              <Text style={styles.editCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.editSaveButton} onPress={saveEdit} disabled={saving || !editDraft.trim()}>
              {saving ? <ActivityIndicator size="small" color={Colors.primaryForeground} /> : <Check size={14} color={Colors.primaryForeground} />}
              <Text style={styles.editSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerState: {
    ...Layout.center, gap: Spacing.two, paddingVertical: Spacing.six,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
  },
  centerStateText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  mapContainer: {
    height: 420, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', backgroundColor: Colors.bgCard,
  },
  webview: { flex: 1, backgroundColor: Colors.bgCard },
  errorBanner: {
    position: 'absolute', top: Spacing.two, left: Spacing.two, right: Spacing.two,
    backgroundColor: `${Colors.red}${Alpha.tint}`, borderRadius: Radius.sm, padding: Spacing.two,
  },
  errorBannerText: { ...Typography.caption, color: Colors.red, textAlign: 'center' },
  regeneratingBadge: {
    position: 'absolute', bottom: Spacing.two, alignSelf: 'center', ...Layout.row, gap: 6,
    backgroundColor: Overlay.panel, borderRadius: Radius.xl, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  regeneratingText: { ...Typography.caption, color: Colors.textSecondary },
  controls: {
    position: 'absolute', top: Spacing.two, right: Spacing.two, backgroundColor: Overlay.panel,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 4, gap: 2,
  },
  ctrlBtn: { width: 32, height: 32, ...Layout.center, borderRadius: Radius.sm },
  ctrlDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  regenerateButton: {
    position: 'absolute', bottom: Spacing.two, left: Spacing.two, ...Layout.row, gap: 5,
    backgroundColor: Overlay.panel, borderRadius: Radius.xl, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  regenerateButtonText: { ...Typography.captionBold, color: Colors.primary },
  editModal: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three, gap: Spacing.two, paddingTop: Spacing.six },
  editLabel: { ...Typography.captionBold, color: Colors.textSecondary },
  editInput: {
    flex: 1, backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.two, fontSize: 14, color: Colors.textPrimary, textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  editCancelButton: {
    ...Layout.row, gap: 6, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.three,
  },
  editCancelText: { ...Typography.captionBold, color: Colors.textSecondary },
  editSaveButton: {
    ...Layout.row, gap: 6, backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.three,
  },
  editSaveText: { ...Typography.captionBold, color: Colors.primaryForeground },
});

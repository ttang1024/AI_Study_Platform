import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';

import { Button } from '@/components/Button';
import { Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import type { Course } from '@/types';

/** Swatches offered when creating/editing a course. First entry matches the web default (#059669). */
const COURSE_COLORS = [
  '#059669', '#3b82f6', '#a855f7', '#ef4444', '#f59e0b',
  '#14b8a6', '#f97316', '#eab308', '#6366f1', '#ec4899',
];

interface CourseEditorModalProps {
  /** When set, the modal edits this course; otherwise it creates a new one. */
  course: Course | null;
  onClose: () => void;
  onSubmit: (data: { courseName: string; courseColor: string }) => Promise<void>;
}

/**
 * Mount this only while open, keyed by the course id (or 'new'), so state seeds
 * fresh from props on each open — no re-seeding effect needed.
 */
export function CourseEditorModal({ course, onClose, onSubmit }: CourseEditorModalProps) {
  const [name, setName] = useState(course?.name ?? '');
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSubmit({ courseName: trimmed, courseColor: color });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{course ? 'Edit course' : 'New course'}</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Course name"
            placeholderTextColor={Colors.textSecondary}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={styles.label}>Color</Text>
          <View style={styles.swatchRow}>
            {COURSE_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
              >
                {color === c && <Check size={16} color={Colors.white} />}
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <View style={styles.saveWrap}>
              {saving ? (
                <View style={styles.savingBox}><ActivityIndicator color={Colors.primaryForeground} /></View>
              ) : (
                <Button title={course ? 'Save' : 'Create'} onPress={handleSave} disabled={!name.trim()} />
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...Layout.fillCenter, backgroundColor: Overlay.backdrop, padding: Spacing.four },
  card: { width: '100%', maxWidth: 360, borderRadius: Radius.lg, backgroundColor: Colors.bgSidebar, padding: Spacing.three, gap: Spacing.one },
  title: { ...Typography.bodyBold, fontSize: 17, color: Colors.textPrimary, marginBottom: Spacing.one },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.textSecondary, marginTop: Spacing.one },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.bgApp,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: 4 },
  swatch: { width: 32, height: 32, borderRadius: 16, ...Layout.center, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: Colors.textPrimary },
  actions: { ...Layout.row, gap: Spacing.two, marginTop: Spacing.three },
  cancelBtn: { ...Layout.fillCenter, height: 48, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  cancelText: { ...Typography.bodyBold, color: Colors.textSecondary },
  saveWrap: { flex: 1 },
  savingBox: { height: 48, borderRadius: Radius.pill, ...Layout.center, backgroundColor: Colors.primary },
});

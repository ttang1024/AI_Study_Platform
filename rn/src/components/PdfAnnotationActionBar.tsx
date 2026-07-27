import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import BrainCircuit from 'lucide-react-native/icons/brain-circuit';
import X from 'lucide-react-native/icons/x';

import { Alpha, Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import { HIGHLIGHT_COLORS, type PdfSelection } from '@/hooks/useAnnotatedPdfViewer';

interface Props {
  selection: PdfSelection;
  note: string;
  setNote: (value: string) => void;
  onDismiss: () => void;
  onSave: (color: string, makeFlashcard?: boolean) => void;
}

/** Floating bar shown over the PDF while text is selected: note input, color picker, "make flashcard". */
export function PdfAnnotationActionBar({ selection, note, setNote, onDismiss, onSave }: Props) {
  return (
    <View style={styles.actionBar}>
      <View style={styles.actionHeader}>
        <Text style={styles.actionText} numberOfLines={1}>“{selection.text}”</Text>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <X size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a note (optional)"
        placeholderTextColor={Colors.textSecondary}
        style={styles.noteInput}
      />
      <View style={styles.actionRow}>
        {HIGHLIGHT_COLORS.map((color) => (
          <Pressable
            key={color}
            style={[styles.colorDot, { backgroundColor: color }]}
            onPress={() => onSave(color)}
            accessibilityLabel={`Highlight in ${color}`}
          />
        ))}
        <View style={styles.actionSpacer} />
        <Pressable style={styles.flashcardButton} onPress={() => onSave(HIGHLIGHT_COLORS[0], true)}>
          <BrainCircuit size={13} color={Colors.primaryForeground} />
          <Text style={styles.flashcardButtonText}>Flashcard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    position: 'absolute', left: Spacing.two, right: Spacing.two, bottom: Spacing.two,
    backgroundColor: Overlay.panel, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.two, gap: Spacing.two,
  },
  actionHeader: { ...Layout.row, gap: Spacing.two },
  actionText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, fontStyle: 'italic' },
  noteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two, paddingVertical: 6, fontSize: 13, color: Colors.textPrimary,
    backgroundColor: Colors.bgCard,
  },
  actionRow: { ...Layout.row, gap: Spacing.two },
  colorDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: `${Colors.textPrimary}${Alpha.strong}`,
  },
  actionSpacer: { flex: 1 },
  flashcardButton: {
    ...Layout.row, gap: 5,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  flashcardButtonText: { ...Typography.captionBold, color: Colors.primaryForeground },
});

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Check from 'lucide-react-native/icons/check';

import { DICTATION_LANGUAGES } from '@/constants/dictationLanguages';
import { Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';

interface LanguageMenuModalProps {
  visible: boolean;
  selectedCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export const LanguageMenuModal: React.FC<LanguageMenuModalProps> = ({ visible, selectedCode, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.title}>Dictation language</Text>
        <ScrollView style={styles.list}>
          {DICTATION_LANGUAGES.map((l) => (
            <Pressable key={l.code} style={styles.item} onPress={() => onSelect(l.code)}>
              <Text style={[styles.itemText, l.code === selectedCode && styles.itemTextActive]}>{l.label}</Text>
              {l.code === selectedCode && <Check size={16} color={Colors.primary} />}
            </Pressable>
          ))}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: { ...Layout.fillCenter, backgroundColor: Overlay.backdrop, padding: Spacing.four },
  card: {
    width: '100%', maxWidth: 320, maxHeight: '70%', borderRadius: Radius.lg,
    backgroundColor: Colors.bgSidebar, padding: Spacing.three,
  },
  title: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: Spacing.two },
  list: {},
  item: {
    ...Layout.rowBetween, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemText: { ...Typography.body, fontSize: 14, color: Colors.textPrimary },
  itemTextActive: { color: Colors.primary, fontWeight: '700' },
});

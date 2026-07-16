import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, X } from 'lucide-react-native';

import { Colors, Layout, Overlay, Spacing } from '@/constants/theme';
import type { ChatMessageAttachment } from '@/services/chatService';

interface AttachmentLightboxModalProps {
  attachment: ChatMessageAttachment | null;
  onClose: () => void;
}

export const AttachmentLightboxModal: React.FC<AttachmentLightboxModalProps> = ({ attachment, onClose }) => (
  <Modal visible={!!attachment} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      {attachment?.mimeType.startsWith('image/') ? (
        <Image source={{ uri: attachment.url }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.file}>
          <FileText size={40} color={Colors.white} />
          <Text style={styles.fileText}>{attachment?.fileName ?? 'Attachment'}</Text>
        </View>
      )}
      <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
        <X size={22} color={Colors.white} />
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: { ...Layout.fillCenter, backgroundColor: Overlay.backdropDark },
  image: { width: '100%', height: '80%' },
  file: { alignItems: 'center', gap: Spacing.two },
  fileText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  close: { position: 'absolute', top: 50, right: 20, padding: Spacing.two },
});

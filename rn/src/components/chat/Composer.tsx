import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Languages, Mic, MicOff, Paperclip, Send } from 'lucide-react-native';

import { Alpha, Colors, Gradients, Layout, Radius, Shadows, Spacing } from '@/constants/theme';

interface DictationControls {
  supported: boolean;
  listening: boolean;
  onToggle: () => void;
  onOpenLanguageMenu: () => void;
}

interface ComposerProps {
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
  // Disables attach/mic/language buttons and the text input itself — e.g. while
  // a message is in flight. Distinct from `disabled`, which only gates Send
  // (GroupChatView has no in-flight state but still needs Send disabled/enabled).
  busy?: boolean;
  placeholder?: string;
  // Omit to render a composer with no attach button (e.g. group chat, which has no attachments).
  onOpenAttachMenu?: () => void;
  // Omit to render a composer with no mic/language buttons.
  dictation?: DictationControls;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  onChangeInput,
  onSend,
  disabled,
  busy = false,
  placeholder = 'Ask anything…',
  onOpenAttachMenu,
  dictation,
}) => (
  <View style={styles.composer}>
    {!!onOpenAttachMenu && (
      <Pressable style={styles.attachButton} onPress={onOpenAttachMenu} disabled={busy}>
        <Paperclip size={19} color={Colors.textSecondary} />
      </Pressable>
    )}
    {dictation?.supported && (
      <Pressable style={[styles.attachButton, dictation.listening && styles.micButtonActive]} onPress={dictation.onToggle} disabled={busy}>
        {dictation.listening ? <MicOff size={19} color={Colors.red} /> : <Mic size={19} color={Colors.textSecondary} />}
      </Pressable>
    )}
    {dictation?.supported && (
      <Pressable style={styles.attachButton} onPress={dictation.onOpenLanguageMenu} disabled={busy || dictation.listening}>
        <Languages size={19} color={Colors.textSecondary} />
      </Pressable>
    )}
    <TextInput
      value={input}
      onChangeText={onChangeInput}
      placeholder={dictation?.listening ? 'Listening…' : placeholder}
      placeholderTextColor={Colors.textSecondary}
      style={styles.input}
      multiline
      editable={!busy}
    />
    <Pressable style={[styles.sendButton, disabled && styles.sendButtonDisabled]} onPress={onSend} disabled={disabled}>
      <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendGradient}>
        <Send size={18} color={Colors.primaryForeground} />
      </LinearGradient>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one,
    padding: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  attachButton: { width: 38, height: 44, ...Layout.center, borderRadius: Radius.pill },
  micButtonActive: { backgroundColor: `${Colors.red}${Alpha.tint}` },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, borderRadius: Radius.xl, backgroundColor: Colors.bgApp,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 15, color: Colors.textPrimary,
    marginHorizontal: Spacing.one,
  },
  sendButton: { borderRadius: Radius.pill, ...Shadows.primaryGlow },
  sendGradient: { width: 44, height: 44, borderRadius: Radius.pill, ...Layout.center },
  sendButtonDisabled: { opacity: 0.5 },
});

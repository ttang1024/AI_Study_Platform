import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ClipboardPaste, Share2 } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { extractShareToken } from '@/services/shareService';

/**
 * Entry point for viewing someone else's share link: paste the URL (or bare
 * token) and open the public share/[token] viewer. Exists because share links
 * point at the web origin — the app can't claim them without universal links.
 */
export default function SharedLinkScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);

  const open = (value: string) => {
    const token = extractShareToken(value);
    if (!token) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    router.push(`/share/${token}`);
  };

  const pasteAndOpen = async () => {
    const clip = (await Clipboard.getStringAsync()).trim();
    if (clip) setInput(clip);
    open(clip);
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Share2 size={22} color={Colors.primary} />
        </View>
        <Text style={styles.heading}>Open a shared link</Text>
        <Text style={styles.subtitle}>
          Paste a Study Platform share link (or its code) to view the summary, flashcards, quiz, and more.
        </Text>
        <TextInput
          value={input}
          onChangeText={(v) => { setInput(v); setInvalid(false); }}
          placeholder="https://…/share/AbC123 or AbC123"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          onSubmitEditing={() => open(input)}
          returnKeyType="go"
        />
        {invalid && <Text style={styles.invalidText}>That doesn’t look like a share link or code.</Text>}
        <Button title="Open" onPress={() => open(input)} disabled={!input.trim()} />
        <Pressable style={styles.pasteRow} onPress={pasteAndOpen}>
          <ClipboardPaste size={14} color={Colors.primary} />
          <Text style={styles.pasteText}>Paste from clipboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.four,
    gap: Spacing.two, alignItems: 'stretch', ...Shadows.card,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: Radius.md, backgroundColor: `${Colors.primary}1a`,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  heading: { ...Typography.heading, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary,
    backgroundColor: Colors.bgSidebar,
  },
  invalidText: { ...Typography.caption, color: Colors.red },
  pasteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  pasteText: { ...Typography.captionBold, color: Colors.primary },
});

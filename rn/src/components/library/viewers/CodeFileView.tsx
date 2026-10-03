import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Check from 'lucide-react-native/icons/check';
import Copy from 'lucide-react-native/icons/copy';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { tokenizeLines, type TokenKind } from '@core/viewers/syntaxHighlight';

// The shared tokenizer's kinds, mapped onto this app's palette.
const TOKEN_COLOR: Record<TokenKind, string> = {
  comment: Colors.textSecondary,
  string: Colors.amber,
  number: Colors.purple,
  keyword: Colors.teal,
  plain: Colors.textPrimary,
};

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

interface Props {
  code: string;
  /** Only the extension matters — it selects the highlighter grammar. */
  fileName: string;
  /** Replaces the line count above the gutter, e.g. "In [1]". */
  caption?: string;
}

/**
 * Read-only source view. Long lines scroll horizontally rather than wrapping,
 * which is what makes indented code readable on a phone; the gutter scrolls
 * with them so a line number always sits beside its own line.
 */
export function CodeFileView({ code, fileName, caption }: Props) {
  const lines = useMemo(() => tokenizeLines(code, fileName), [code, fileName]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const gutterWidth = 12 + String(lines.length).length * 8;

  return (
    <View style={styles.card}>
      <View style={styles.bar}>
        <Text style={styles.caption} numberOfLines={1}>
          {caption ?? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`}
        </Text>
        <Pressable style={styles.copyButton} onPress={copy} hitSlop={8} accessibilityLabel="Copy file contents">
          {copied ? <Check size={13} color={Colors.primary} /> : <Copy size={13} color={Colors.textSecondary} />}
          <Text style={[styles.copyText, copied && styles.copyTextDone]}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scrollInner}>
        <View>
          {lines.map((tokens, index) => (
            <View key={index} style={styles.line}>
              <Text style={[styles.lineNumber, { width: gutterWidth }]} selectable={false}>
                {index + 1}
              </Text>
              <Text style={styles.lineText} selectable>
                {tokens.map((token, tokenIndex) => (
                  <Text key={tokenIndex} style={{ color: TOKEN_COLOR[token.kind] }}>
                    {token.text}
                  </Text>
                ))}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.bgCard, overflow: 'hidden',
  },
  bar: {
    ...Layout.rowBetween, gap: Spacing.two,
    paddingHorizontal: Spacing.two, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgApp,
  },
  caption: { flex: 1, fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  copyButton: { ...Layout.row, gap: 4 },
  copyText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  copyTextDone: { color: Colors.primary },
  scrollInner: { minWidth: '100%' },
  line: { ...Layout.row, alignItems: 'flex-start' },
  lineNumber: {
    fontFamily: MONO, fontSize: 11, lineHeight: 20, textAlign: 'right',
    paddingRight: 8, color: Colors.zinc300, backgroundColor: Colors.bgApp,
  },
  lineText: { fontFamily: MONO, fontSize: 12, lineHeight: 20, paddingRight: Spacing.three },
});

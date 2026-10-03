import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { dataCaption, prettyPrintData } from '@core/viewers/dataFile';
import type { DocumentViewerKind } from '@core/services/documentService';
import { CodeFileView } from './CodeFileView';
import { NotebookFileView } from './NotebookFileView';
import { SubtitleFileView } from './SubtitleFileView';
import { TableFileView } from './TableFileView';

/** Kinds this component renders from the file's text. */
export const TEXT_VIEWER_KINDS: DocumentViewerKind[] = [
  'text', 'md', 'code', 'data', 'table', 'notebook', 'subtitle',
];

interface Props {
  /** Pre-signed download URL — no auth header needed. */
  url: string;
  fileName: string;
  kind: DocumentViewerKind;
}

/**
 * Renders a text-shaped document natively, matching the web detail page.
 *
 * The URL is the same one the WebView preview uses; for these formats a WebView
 * would only show unstyled, unhighlighted text, so the bytes are fetched and
 * parsed here instead.
 */
export function DocumentFileView({ url, fileName, kind }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.text();
        if (!cancelled) setText(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed)
    return (
      <View style={styles.status}>
        <Text style={styles.statusText}>Couldn&apos;t load this file.</Text>
      </View>
    );

  if (text === null)
    return (
      <View style={styles.status}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );

  if (kind === 'md') return <SummaryMarkdown value={text} />;
  if (kind === 'table') return <TableFileView text={text} fileName={fileName} />;
  if (kind === 'notebook') return <NotebookFileView text={text} fileName={fileName} />;
  if (kind === 'subtitle') return <SubtitleFileView text={text} fileName={fileName} />;
  if (kind === 'code') return <CodeFileView code={text} fileName={fileName} />;
  if (kind === 'data')
    return (
      <CodeFileView
        code={prettyPrintData(text, fileName)}
        fileName={fileName}
        caption={dataCaption(text, fileName)}
      />
    );

  return <Text style={styles.plain} selectable>{text}</Text>;
}

const styles = StyleSheet.create({
  status: {
    paddingVertical: Spacing.four, alignItems: 'center', gap: Spacing.two,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bgCard,
  },
  statusText: { fontSize: 13, color: Colors.textSecondary },
  plain: { fontSize: 14, lineHeight: 21, color: Colors.textPrimary },
});

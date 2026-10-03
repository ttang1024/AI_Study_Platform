import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { notebookCodeFileName, parseNotebook } from '@core/viewers/notebook';
import { CodeFileView } from './CodeFileView';

interface Props {
  text: string;
  fileName: string;
}

/**
 * Read-only Jupyter rendering: markdown cells through the app's markdown
 * renderer, code cells highlighted, and whatever outputs were saved with the
 * notebook. Nothing runs — the platform's runnable cells are a separate feature.
 */
export function NotebookFileView({ text, fileName }: Props) {
  const notebook = useMemo(() => parseNotebook(text), [text]);

  // Not a notebook after all (truncated upload, wrong extension) — show the JSON.
  if (!notebook) return <CodeFileView code={text} fileName={fileName} />;

  const codeFileName = notebookCodeFileName(notebook);

  return (
    <View style={styles.cells}>
      {notebook.cells.map((cell, index) => {
        if (cell.kind === 'markdown') return <SummaryMarkdown key={index} value={cell.source} />;

        if (cell.kind === 'raw')
          return (
            <Text key={index} style={styles.rawCell} selectable>
              {cell.source}
            </Text>
          );

        return (
          <View key={index} style={styles.codeCell}>
            <CodeFileView
              code={cell.source}
              fileName={codeFileName}
              caption={cell.executionCount != null ? `In [${cell.executionCount}]` : 'In [ ]'}
            />
            {cell.outputs.map((output, outputIndex) =>
              output.kind === 'svg' ? (
                <View key={outputIndex} style={styles.outputImage}>
                  <SvgXml xml={output.value} width="100%" height="100%" />
                </View>
              ) : output.kind === 'image' ? (
                <Image
                  key={outputIndex}
                  source={{ uri: output.value }}
                  style={styles.outputImage}
                  contentFit="contain"
                  accessibilityLabel="Cell output"
                />
              ) : (
                <Text
                  key={outputIndex}
                  style={[styles.output, output.kind === 'error' && styles.errorOutput]}
                  selectable
                >
                  {output.value}
                </Text>
              ),
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cells: { gap: Spacing.three },
  codeCell: { gap: Spacing.one },
  rawCell: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary, backgroundColor: Colors.bgApp, padding: Spacing.two, borderRadius: Radius.md },
  output: {
    fontSize: 12, lineHeight: 18, color: Colors.textPrimary,
    backgroundColor: Colors.bgApp, padding: Spacing.two, borderRadius: Radius.md,
  },
  errorOutput: { color: Colors.errorText, backgroundColor: `${Colors.red}14` },
  outputImage: { width: '100%', height: 220, borderRadius: Radius.md, backgroundColor: Colors.bgApp },
});

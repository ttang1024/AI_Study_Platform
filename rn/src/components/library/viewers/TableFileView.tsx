import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { isTabular, parseDelimited } from '@core/viewers/delimitedText';
import { CodeFileView } from './CodeFileView';

const COLUMN_WIDTH = 132;
const INDEX_WIDTH = 34;

interface Props {
  text: string;
  fileName: string;
}

const isNumeric = (value: string) => value !== '' && !Number.isNaN(Number(value.replace(/,/g, '')));

/**
 * CSV/TSV as a scrollable grid. Files that do not parse into one (a single
 * column, or prose that happens to be named .csv) fall back to the source view
 * rather than showing a one-column table that hides the content.
 */
export function TableFileView({ text, fileName }: Props) {
  const table = useMemo(() => parseDelimited(text, fileName), [text, fileName]);

  if (!isTabular(table)) return <CodeFileView code={text} fileName={fileName} />;

  const numericColumns = table.headers.map((_, column) =>
    table.rows.every((row) => !row[column] || isNumeric(row[column])),
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {table.totalRows} rows · {table.headers.length} columns
        </Text>
        {table.truncated && <Text style={styles.truncated}>first {table.rows.length}</Text>}
      </View>

      <View style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.headerRow}>
              <Text style={[styles.headerCell, styles.indexCell]}> </Text>
              {table.headers.map((header, index) => (
                <Text key={index} style={styles.headerCell} numberOfLines={2}>
                  {header || '—'}
                </Text>
              ))}
            </View>

            {/* No vertical ScrollView here: the preview box already owns one, and
                nesting same-direction scrollers makes the inner list swallow the
                drag. */}
            {table.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                <Text style={[styles.cell, styles.indexCell]}>{rowIndex + 1}</Text>
                {table.headers.map((_, column) => (
                  <Text
                    key={column}
                    style={[styles.cell, numericColumns[column] && styles.numericCell]}
                    numberOfLines={2}
                  >
                    {row[column] ?? ''}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  metaRow: { ...Layout.rowBetween, gap: Spacing.two },
  meta: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  truncated: { fontSize: 11, fontWeight: '700', color: Colors.amber },
  card: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    overflow: 'hidden', backgroundColor: Colors.bgCard,
  },
  headerRow: { ...Layout.row, backgroundColor: Colors.bgApp, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerCell: {
    width: COLUMN_WIDTH, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one,
    fontSize: 12, fontWeight: '800', color: Colors.textPrimary,
  },
  row: { ...Layout.row, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cell: {
    width: COLUMN_WIDTH, paddingHorizontal: Spacing.two, paddingVertical: 6,
    fontSize: 12, color: Colors.textPrimary,
  },
  numericCell: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  indexCell: { width: INDEX_WIDTH, textAlign: 'right', color: Colors.zinc300, fontWeight: '400' },
});

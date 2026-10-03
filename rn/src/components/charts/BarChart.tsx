import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { ChartBucket } from '@/utils/analyticsBuckets';

const CHART_HEIGHT = 120;

interface BarChartProps {
  buckets: ChartBucket[];
  colorFor?: (value: number) => string;
  valueLabel?: (value: number) => string;
}

// Hand-rolled to match web's own AnalyticsSection.tsx, which is plain divs with no charting
// library — these are simple self-scaled bar charts, not worth a charting dependency for.
export const BarChart: React.FC<BarChartProps> = ({ buckets, colorFor, valueLabel = String }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  // Skip labels to avoid crowding, same spacing rule as web (label every ~7th bar).
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 7));

  return (
    <View style={styles.root}>
      {selected !== null && (
        <Text style={styles.tooltip}>{buckets[selected].label} · {valueLabel(buckets[selected].value)}</Text>
      )}
      <View style={styles.chart}>
        {buckets.map((bucket, i) => (
          <Pressable key={i} style={styles.barColumn} onPress={() => setSelected(selected === i ? null : i)}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${(bucket.value / max) * 100}%`,
                    backgroundColor: colorFor ? colorFor(bucket.value) : Colors.primary,
                  },
                  selected === i && styles.barSelected,
                ]}
              />
            </View>
            {i % labelEvery === 0 && <Text style={styles.barLabel} numberOfLines={1}>{bucket.label}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  tooltip: { ...Typography.captionBold, color: Colors.textPrimary, textAlign: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 3 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: CHART_HEIGHT - 18, justifyContent: 'flex-end' },
  bar: { width: '100%', minHeight: 2, borderRadius: Radius.sm },
  barSelected: { opacity: 0.7 },
  barLabel: { ...Typography.caption, fontSize: 9, color: Colors.textSecondary, marginTop: 2 },
});

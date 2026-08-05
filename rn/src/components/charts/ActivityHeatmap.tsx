import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import type { ActivityHeatmap as ActivityHeatmapData } from '@core/services/analyticsService';

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const WEEKS = 53;
const LEVEL_OPACITY = [0, 0.28, 0.48, 0.72, 1];

interface DayCell {
  date: Date;
  key: string;
  reviews: number;
  minutes: number;
  score: number;
  inRange: boolean;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Same grid math as web's ActivityHeatmapSection — 53 week-columns ending in the
 *  week containing `to`, so the two surfaces always agree pixel-for-pixel in shape. */
const buildGrid = (data: ActivityHeatmapData): DayCell[][] => {
  const byDay = new Map<string, { reviews: number; minutes: number }>();
  for (const d of data.days) byDay.set(d.date.slice(0, 10), { reviews: d.reviews, minutes: d.studyMinutes });

  const to = new Date(data.to);
  const from = new Date(data.from);
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));
  const gridStart = new Date(gridEnd);
  gridStart.setUTCDate(gridStart.getUTCDate() - (WEEKS * 7 - 1));

  const weeks: DayCell[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < WEEKS; w++) {
    const col: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      const activity = byDay.get(key);
      col.push({
        date: new Date(cursor),
        key,
        reviews: activity?.reviews ?? 0,
        minutes: activity?.minutes ?? 0,
        score: (activity?.reviews ?? 0) + (activity?.minutes ?? 0),
        inRange: cursor >= from && cursor <= end,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(col);
  }
  return weeks;
};

export const ActivityHeatmap: React.FC<{ data: ActivityHeatmapData }> = ({ data }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<DayCell | null>(null);
  const weeks = useMemo(() => buildGrid(data), [data]);

  // Quartile thresholds over the non-zero scores, so a light-study week and a heavy
  // one both get the full four-level range instead of everything landing on level 1.
  // A plain helper (not a useMemo returning a closure) — the React Compiler couldn't
  // preserve manual memoization across a returned function.
  const thresholds = useMemo(() => {
    const scores = weeks.flat().filter((c) => c.score > 0).map((c) => c.score).sort((a, b) => a - b);
    if (scores.length === 0) return null;
    const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
    return [q(0.25), q(0.5), q(0.75)] as const;
  }, [weeks]);

  const level = (score: number): number => {
    if (score === 0 || !thresholds) return 0;
    const [q1, q2, q3] = thresholds;
    return score <= q1 ? 1 : score <= q2 ? 2 : score <= q3 ? 3 : 4;
  };

  const monthLabels = useMemo(() => {
    const labels: { w: number; text: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((col, w) => {
      const m = col[0].date.getUTCMonth();
      if (m !== lastMonth) {
        if (labels.length === 0 || w - labels[labels.length - 1].w >= 3) {
          labels.push({ w, text: col[0].date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }) });
        }
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View>
          <View style={styles.monthRow}>
            {monthLabels.map((m) => (
              <Text key={`${m.text}-${m.w}`} style={[styles.monthLabel, { left: m.w * STEP }]}>{m.text}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {weeks.map((col, w) => (
              <View key={w} style={styles.column}>
                {col.map((cell) => {
                  if (!cell.inRange) return <View key={cell.key} style={styles.cellEmpty} />;
                  const lv = level(cell.score);
                  const isSelected = selected?.key === cell.key;
                  return (
                    <Pressable
                      key={cell.key}
                      hitSlop={3}
                      onPress={() => setSelected(isSelected ? null : cell)}
                      style={[
                        styles.cell,
                        lv === 0
                          ? styles.cellZero
                          : { backgroundColor: Colors.primary, opacity: LEVEL_OPACITY[lv] },
                        isSelected && styles.cellSelected,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={1}>
          {selected
            ? `${selected.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${selected.reviews} reviews · ${selected.minutes} min`
            : `${data.totalReviews} reviews · ${Math.round(data.totalStudyMinutes / 60)}h studied · ${data.activeDays} active days`}
        </Text>
        <View style={styles.legend}>
          <Text style={styles.legendLabel}>Less</Text>
          {LEVEL_OPACITY.map((o, i) => (
            <View
              key={i}
              style={[styles.legendCell, i === 0 ? styles.cellZero : { backgroundColor: Colors.primary, opacity: o }]}
            />
          ))}
          <Text style={styles.legendLabel}>More</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  monthRow: { height: 14 },
  monthLabel: { position: 'absolute', top: 0, ...Typography.caption, fontSize: 9, color: Colors.textSecondary },
  grid: { flexDirection: 'row', gap: GAP, marginTop: 4 },
  column: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 2.5 },
  cellEmpty: { width: CELL, height: CELL },
  cellZero: { backgroundColor: Colors.zinc200 },
  cellSelected: { borderWidth: 1.5, borderColor: Colors.textPrimary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  footerText: { ...Typography.caption, fontSize: 11, color: Colors.textSecondary, flex: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendLabel: { ...Typography.caption, fontSize: 9, color: Colors.textSecondary },
  legendCell: { width: CELL, height: CELL, borderRadius: 2.5 },
});

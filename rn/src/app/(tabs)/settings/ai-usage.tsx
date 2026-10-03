import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Info from 'lucide-react-native/icons/info';

import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { analyticsService, type AiUsage, type AiUsageGroup } from '@/services/analyticsService';

// Mirrors web/src/components/settings/AiUsageTab.tsx.

const RANGES = [7, 30, 90] as const;

/** Warn once the day's spend is this far into the limit. */
const QUOTA_WARN_FRACTION = 0.8;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat();

/**
 * Rounding an estimate to cents would report a real $0.004 call as "$0.00". Show enough precision
 * that small spend still reads as spend.
 */
function formatUsd(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  return `$${value.toFixed(2)}`;
}

/** Operations arrive as "quiz:text" / "chat:document" — readable, but not prose. */
function humanizeOperation(key: string): string {
  const [feature, variant] = key.split(':');
  const label = feature.replace(/[-_]/g, ' ');
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  return variant ? `${pretty} (${variant})` : pretty;
}

const Breakdown: React.FC<{
  title: string;
  caption: string;
  rows: AiUsageGroup[];
  formatKey?: (key: string) => string;
}> = ({ title, caption, rows, formatKey }) => {
  // Bars are relative to the biggest row, so the smallest spend stays visible rather than
  // collapsing to nothing against a total.
  const max = Math.max(...rows.map((r) => r.estimatedCostUsd), 0);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>No calls in this range.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowKey} numberOfLines={1}>
                {formatKey ? formatKey(row.key) : row.key}
              </Text>
              <Text style={styles.rowMeta}>
                {formatUsd(row.estimatedCostUsd)} · {compact.format(row.totalTokens)} tok · {row.calls}
                {row.calls === 1 ? ' call' : ' calls'}
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: max > 0 ? `${Math.max((row.estimatedCostUsd / max) * 100, 2)}%` : '0%' },
                ]}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
};

export default function AiUsageScreen() {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<number>(30);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `loading`/`error` are reset in the range-chip handler (and via their initial
  // values on mount) rather than here, so the effect never sets state synchronously.
  useEffect(() => {
    analyticsService
      .getAiUsage(isoDaysAgo(days))
      .then(setUsage)
      .catch(() => setError('Could not load usage.'))
      .finally(() => setLoading(false));
  }, [days]);

  const changeRange = (range: number) => {
    setLoading(true);
    setError(null);
    setDays(range);
  };

  const quota = useMemo(() => {
    if (!usage || usage.dailyTokenLimit <= 0) return null;
    const fraction = Math.min(usage.tokensUsedToday / usage.dailyTokenLimit, 1);
    return { fraction, nearLimit: fraction >= QUOTA_WARN_FRACTION };
  }, [usage]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}
    >
      <View style={styles.ranges}>
        {RANGES.map((range) => (
          <Pressable
            key={range}
            onPress={() => changeRange(range)}
            style={[styles.rangeChip, days === range && styles.rangeChipActive]}
          >
            <Text style={[styles.rangeLabel, days === range && styles.rangeLabelActive]}>
              {range} days
            </Text>
          </Pressable>
        ))}
      </View>

      {/* The keys are the user's own, so this spend is on their provider bill, not ours. Without
          saying so these numbers look like something we are about to charge them for. */}
      <View style={styles.notice}>
        <Info size={16} color={Colors.textSecondary} />
        <Text style={styles.noticeText}>
          These calls run on your own API keys and are billed by your provider, not by us. Costs are
          estimated from each model&apos;s published rates and are a guide, not an invoice.
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : usage ? (
        <>
          <View style={styles.stats}>
            {[
              { label: 'Estimated cost', value: formatUsd(usage.totals.estimatedCostUsd) },
              { label: 'Tokens', value: compact.format(usage.totals.totalTokens) },
              { label: 'Calls', value: plain.format(usage.totals.calls) },
            ].map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {/* Cache hits are billed at a steep discount or not at all — the one number here that is
              money saved rather than money spent. */}
          {usage.totals.cachedPromptTokens > 0 && (
            <Text style={styles.cacheNote}>
              {plain.format(usage.totals.cachedPromptTokens)} prompt tokens were served from your
              provider&apos;s cache at a discount.
            </Text>
          )}

          {quota && (
            <View style={styles.section}>
              <View style={styles.rowHeader}>
                <Text style={styles.sectionTitle}>Today&apos;s token budget</Text>
                <Text style={[styles.rowMeta, quota.nearLimit && styles.warnText]}>
                  {plain.format(usage.tokensUsedToday)} / {plain.format(usage.dailyTokenLimit)}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${quota.fraction * 100}%` },
                    quota.nearLimit && styles.fillWarn,
                  ]}
                />
              </View>
              {quota.nearLimit && (
                <Text style={[styles.sectionCaption, styles.warnText]}>
                  Close to the daily limit. Further AI calls will be refused until it resets at 00:00 UTC.
                </Text>
              )}
            </View>
          )}

          <Breakdown
            title="By feature"
            caption="Which parts of the app spent your tokens."
            rows={usage.byOperation}
            formatKey={humanizeOperation}
          />
          <Breakdown title="By model" caption="Costliest model first." rows={usage.byModel} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three },

  ranges: { flexDirection: 'row', gap: Spacing.one },
  rangeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgSidebar,
  },
  rangeChipActive: { backgroundColor: Colors.primary },
  rangeLabel: { ...Typography.caption, color: Colors.textSecondary },
  rangeLabelActive: { color: Colors.white, fontWeight: '600' },

  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSidebar,
  },
  noticeText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },

  error: { ...Typography.caption, color: Colors.red },
  loader: { marginTop: Spacing.five },

  stats: { flexDirection: 'row', gap: Spacing.two },
  statCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSidebar,
  },
  statLabel: { ...Typography.caption, color: Colors.textSecondary },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },

  cacheNote: { ...Typography.caption, color: Colors.textSecondary },

  section: { gap: Spacing.one },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  sectionCaption: { ...Typography.caption, color: Colors.textSecondary },
  empty: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },

  row: { gap: 4, marginTop: Spacing.one },
  rowHeader: { ...Layout.rowBetween, gap: Spacing.two },
  rowKey: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', flexShrink: 1 },
  rowMeta: { ...Typography.caption, color: Colors.textSecondary },
  warnText: { color: Colors.amber, fontWeight: '600' },

  track: { height: 6, borderRadius: Radius.pill, backgroundColor: Colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill, backgroundColor: Colors.primary },
  fillWarn: { backgroundColor: Colors.amber },
});

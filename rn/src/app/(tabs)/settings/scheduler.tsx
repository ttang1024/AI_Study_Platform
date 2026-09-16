import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import Gauge from 'lucide-react-native/icons/gauge';
import Info from 'lucide-react-native/icons/info';

import { Button } from '@/components/Button';
import { FilterChip } from '@/components/FilterChip';
import { InfoBanner } from '@/components/InfoBanner';
import { Alpha, Colors, Layout, Radius, Spacing } from '@/constants/theme';
import {
  flashcardService,
  type FsrsSettings,
  type FsrsSettingsPatch,
  type ReviewForecast,
} from '@/services/flashcardService';
import {
  BACKLOG_SPREADS,
  MAX_INTERVAL_PRESETS,
  NEW_PER_DAY_PRESETS,
  RETENTION_PRESETS,
  REVIEWS_PER_DAY_PRESETS,
} from '@core/fsrsPresets';


const percent = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Fourteen days of scheduled load, drawn with plain views — a handful of bars does not warrant
 * pulling a chart library into the bundle. Bars over the user's reviews-per-day ceiling are marked,
 * because that is the only reading here that asks for a decision.
 */
const ForecastStrip: React.FC<{ forecast: ReviewForecast }> = ({ forecast }) => {
  const peak = Math.max(1, ...forecast.days.map((d) => d.count));
  const limit = forecast.maxReviewsPerDay;

  if (forecast.days.every((d) => d.count === 0)) {
    return <Text style={styles.sectionHint}>Nothing is scheduled in the next two weeks.</Text>;
  }

  const label = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={styles.forecast}>
      <View style={styles.forecastBars}>
        {forecast.days.map((d) => (
          <View
            key={d.day}
            style={[
              styles.forecastBar,
              {
                height: Math.max(2, Math.round(48 * (d.count / peak))),
                backgroundColor: limit > 0 && d.count > limit ? Colors.orange : Colors.primary,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.forecastLabels}>
        <Text style={styles.forecastLabel}>{label(forecast.days[0].day)}</Text>
        <Text style={styles.forecastLabel}>{label(forecast.days[forecast.days.length - 1].day)}</Text>
      </View>
      <Text style={styles.forecastLabel}>
        {limit > 0 ? `Busiest day: ${peak} cards, against your ${limit}-a-day limit.` : `Busiest day: ${peak} cards.`}
      </Text>
    </View>
  );
};

export default function SchedulerSettingsScreen() {
  const [settings, setSettings] = useState<FsrsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ReviewForecast | null>(null);

  useEffect(() => {
    let cancelled = false;
    flashcardService
      .getFsrsSettings()
      .then((s) => { if (!cancelled) setSettings(s); })
      .catch(() => { if (!cancelled) setError('Could not load your scheduler settings.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    // The forecast is illustrative, not required — a failure here leaves the settings usable.
    flashcardService
      .getReviewForecast(14)
      .then((f) => { if (!cancelled) setForecast(f); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // One field per control and nothing to validate, so each change saves straight away.
  const patch = async (change: FsrsSettingsPatch) => {
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const previous = settings;
    setSettings((s) => (s ? { ...s, ...change } : s));
    try {
      setSettings(await flashcardService.updateFsrsSettings(change));
    } catch {
      setSettings(previous);
      setError('Could not save that change.');
    } finally {
      setBusy(false);
    }
  };

  const optimize = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await flashcardService.optimizeFsrsWeights();
      setNotice(
        result.applied
          ? `Tuned on ${result.reviewCount.toLocaleString()} reviews — ${percent(result.improvement)} better calibrated.`
          : 'Your history is already best explained by the default scheduler, so nothing changed.',
      );
      setSettings(await flashcardService.getFsrsSettings());
    } catch {
      setError('Could not tune the scheduler. Try again once you have more reviews.');
    } finally {
      setBusy(false);
    }
  };

  const resetWeights = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      setSettings(await flashcardService.resetFsrsWeights());
      setNotice('Back to the default scheduler.');
    } catch {
      setError('Could not reset the scheduler.');
    } finally {
      setBusy(false);
    }
  };

  const spreadBacklog = async (days: number) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await flashcardService.rescheduleBacklog(days);
      setNotice(
        result.moved === 0
          ? 'Nothing is overdue.'
          : `Spread ${result.moved.toLocaleString()} card${result.moved === 1 ? '' : 's'} over ${result.days} days, about ${result.perDay} a day.`,
      );
      setForecast(await flashcardService.getReviewForecast(14));
    } catch {
      setError('Could not reschedule the backlog.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Scheduler settings are unavailable.'}</Text>
      </View>
    );
  }

  const canOptimize = settings.reviewCount >= settings.minimumReviewsToOptimize;
  const progress = Math.min(100, Math.round((settings.reviewCount / settings.minimumReviewsToOptimize) * 100));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        How FSRS decides when each flashcard comes back. Changes apply to reviews from here on —
        cards already scheduled keep their current due date.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {notice && <Text style={styles.successText}>{notice}</Text>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Target retention</Text>
        <Text style={styles.sectionHint}>
          The chance you want of remembering a card when it comes up. Aiming higher means seeing each
          card more often.
        </Text>
        {RETENTION_PRESETS.map((preset) => {
          const active = Math.abs(settings.desiredRetention - preset.value) < 0.001;
          return (
            <Pressable
              key={preset.value}
              style={[styles.optionRow, active && styles.optionRowActive]}
              onPress={() => patch({ desiredRetention: preset.value })}
            >
              <View style={styles.optionBody}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{preset.label}</Text>
                <Text style={styles.optionHint}>{preset.hint}</Text>
              </View>
              <Text style={[styles.optionValue, active && styles.optionLabelActive]}>{percent(preset.value)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Maximum interval</Text>
        <Text style={styles.sectionHint}>
          The furthest out a card can ever be scheduled. Useful when an exam means nothing should
          disappear for years.
        </Text>
        <View style={styles.chipRow}>
          {MAX_INTERVAL_PRESETS.map((preset) => (
            <FilterChip
              key={preset.value}
              label={preset.label}
              active={settings.maximumIntervalDays === preset.value}
              onPress={() => patch({ maximumIntervalDays: preset.value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New cards per day</Text>
        <Text style={styles.sectionHint}>
          How many never-seen cards a session introduces. Every new card is a review commitment for
          months, so this is the dial that sets your long-run workload.
        </Text>
        <View style={styles.chipRow}>
          {NEW_PER_DAY_PRESETS.map((value) => (
            <FilterChip
              key={value}
              label={value === 0 ? 'None' : String(value)}
              active={settings.newCardsPerDay === value}
              onPress={() => patch({ newCardsPerDay: value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reviews per day</Text>
        <Text style={styles.sectionHint}>
          A ceiling on the whole queue, so a heavy day stays finishable. Cards over the limit wait
          rather than disappearing.
        </Text>
        <View style={styles.chipRow}>
          {REVIEWS_PER_DAY_PRESETS.map((value) => (
            <FilterChip
              key={value}
              label={value === 0 ? 'No limit' : String(value)}
              active={settings.maxReviewsPerDay === value}
              onPress={() => patch({ maxReviewsPerDay: value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.optionBody}>
          <Text style={styles.optionLabel}>Spread out due dates</Text>
          <Text style={styles.optionHint}>
            Nudges intervals by a few percent so a batch of cards generated together doesn&apos;t come
            back as one giant pile every time.
          </Text>
        </View>
        <Switch
          value={settings.enableFuzz}
          onValueChange={(value) => patch({ enableFuzz: value })}
          disabled={busy}
          trackColor={{ true: Colors.primary }}
        />
      </View>

      {forecast && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CalendarClock size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>The next two weeks</Text>
          </View>
          <ForecastStrip forecast={forecast} />
          {forecast.overdue > 0 && (
            <View style={styles.statBox}>
              <Text style={styles.statLine}>
                <Text style={styles.statTitle}>{forecast.overdue.toLocaleString()}</Text> card
                {forecast.overdue === 1 ? ' is' : 's are'} overdue. Spreading them out moves only the
                due dates — what the scheduler thinks you know is untouched.
              </Text>
              <View style={styles.chipRow}>
                {BACKLOG_SPREADS.map((days) => (
                  <FilterChip
                    key={days}
                    label={`Over ${days} days`}
                    active={false}
                    onPress={() => spreadBacklog(days)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Gauge size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Tune to your memory</Text>
        </View>
        <Text style={styles.sectionHint}>
          FSRS ships with weights averaged over many learners. Once you have enough review history,
          they can be refitted to how you actually forget.
        </Text>

        {settings.usingOptimizedWeights ? (
          <View style={styles.statBox}>
            <Text style={styles.statTitle}>Using your own weights</Text>
            <Text style={styles.statLine}>
              Fitted on {settings.reviewsAtOptimization.toLocaleString()} reviews
              {settings.weightsOptimizedAt ? ` on ${new Date(settings.weightsOptimizedAt).toLocaleDateString()}` : ''}.
            </Text>
            {settings.logLossBefore != null && settings.logLossAfter != null && (
              <Text style={styles.statLine}>
                Prediction error {settings.logLossBefore.toFixed(4)} → {settings.logLossAfter.toFixed(4)} (lower is better).
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <Text style={styles.statLine}>{settings.reviewCount.toLocaleString()} reviews logged</Text>
              <Text style={styles.statLine}>{settings.minimumReviewsToOptimize.toLocaleString()} needed</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}

        <Button
          title={settings.usingOptimizedWeights ? 'Re-tune' : 'Tune scheduler'}
          onPress={optimize}
          loading={busy}
          disabled={!canOptimize || busy}
        />
        {settings.usingOptimizedWeights && (
          <Button title="Use defaults" variant="secondary" onPress={resetWeights} disabled={busy} />
        )}
        {!canOptimize && (
          <InfoBanner
            icon={Info}
            text={`Keep reviewing — tuning needs ${(settings.minimumReviewsToOptimize - settings.reviewCount).toLocaleString()} more reviews before it can say anything meaningful.`}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp, padding: Spacing.three },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  optionRow: {
    ...Layout.rowBetween, gap: Spacing.two, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.bgSidebar, paddingHorizontal: 14, paddingVertical: 12,
  },
  optionRowActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.wash}` },
  optionBody: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 14, color: Colors.textPrimary },
  optionLabelActive: { fontWeight: '700', color: Colors.primary },
  optionHint: { fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },
  optionValue: { fontSize: 13, color: Colors.textSecondary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  toggleRow: {
    ...Layout.rowBetween, gap: Spacing.two, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, backgroundColor: Colors.bgSidebar, paddingHorizontal: 14, paddingVertical: 12,
  },

  card: {
    gap: Spacing.two, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.bgSidebar, padding: Spacing.two,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  statBox: { gap: 3, borderRadius: Radius.md, backgroundColor: Colors.bgApp, padding: Spacing.two },
  statTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  statLine: { fontSize: 11, color: Colors.textSecondary },

  forecast: { gap: 6 },
  forecastBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 48 },
  forecastBar: { flex: 1, borderRadius: 2 },
  forecastLabels: { ...Layout.rowBetween },
  forecastLabel: { fontSize: 10, color: Colors.textSecondary },

  progressBlock: { gap: 6 },
  progressLabels: { ...Layout.rowBetween },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.zinc200, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },

  errorText: { fontSize: 12, fontWeight: '600', color: Colors.red },
  successText: { fontSize: 12, fontWeight: '600', color: Colors.emerald },
});

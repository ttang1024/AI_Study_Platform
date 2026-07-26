import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Circle from 'lucide-react-native/icons/circle';
import Sparkles from 'lucide-react-native/icons/sparkles';
import X from 'lucide-react-native/icons/x';

import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { onboardingService, type OnboardingState } from '@/services/onboardingService';

/** Web action paths mapped onto rn's route tree — the two navigations do not share a URL space. */
const ROUTE_FOR_STEP: Record<string, string> = {
  course: '/(tabs)/library',
  upload: '/(tabs)/summarizer',
  generate: '/(tabs)/library',
  review: '/(tabs)/study/flashcards',
};

/**
 * Getting-started checklist for a new account.
 *
 * Renders nothing once dismissed or complete — a checklist that outlives its usefulness is clutter
 * on the one screen the user sees most. Step completion is derived server-side from the library, so
 * a tick cannot survive deleting whatever earned it.
 */
export const OnboardingChecklist: React.FC = () => {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await onboardingService.getState();
      setState(res.data?.data ?? null);
    } catch {
      setState(null);
    }
  }, []);

  // Wrapped so every setState lands in an async continuation rather than the effect body. Each
  // `load` begins with an await, so nothing was setting state synchronously anyway — this just
  // makes that visible to the compiler's effect analysis.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  if (!state || state.dismissed || state.complete) return null;

  const dismiss = async () => {
    setState(null); // Optimistic: the card should go on tap, not after a round trip.
    try {
      await onboardingService.dismiss();
    } catch {
      void load();
    }
  };

  const addSample = async () => {
    setBusy(true);
    try {
      await onboardingService.seedDemo();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.subtitle}>
            {state.completedCount} of {state.totalCount} done
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel="Dismiss checklist">
          <X size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ProgressBar progress={state.completedCount / state.totalCount} color={Colors.primary} />

      <View style={styles.steps}>
        {state.steps.map((step) => (
          <Pressable
            key={step.key}
            disabled={step.done}
            onPress={() => {
              const route = ROUTE_FOR_STEP[step.key];
              if (route) router.push(route as never);
            }}
            style={styles.step}
          >
            {step.done ? (
              <Check size={16} color={Colors.primary} />
            ) : (
              <Circle size={16} color={Colors.textSecondary} />
            )}
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, step.done && styles.stepDone]}>{step.title}</Text>
              {!step.done && <Text style={styles.stepDescription}>{step.description}</Text>}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Offered only until they have their own material: the sample exists to show the product
          working before an AI provider key is configured, not to pad a real library. */}
      {!state.hasDemoContent && (
        <Pressable onPress={addSample} disabled={busy} style={styles.sampleButton}>
          {busy ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Sparkles size={15} color={Colors.primary} />
          )}
          <Text style={styles.sampleText}>Add a sample course to look around first</Text>
        </Pressable>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  headerText: { flex: 1 },
  title: { ...Typography.subheading, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  steps: { gap: Spacing.two, marginTop: Spacing.one },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  stepText: { flex: 1 },
  stepTitle: { ...Typography.body, color: Colors.textPrimary },
  stepDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  stepDescription: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  sampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingVertical: Spacing.one,
    borderRadius: Radius.md,
  },
  sampleText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
});

export default OnboardingChecklist;

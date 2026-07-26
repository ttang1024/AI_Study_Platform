import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import ExternalLink from 'lucide-react-native/icons/external-link';

import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { billingService, type MyPlan, type Plan, type PlanKey } from '@/services/billingService';

const formatLimit = (tokens: number): string =>
  tokens <= 0 ? 'Unlimited' : `${(tokens / 1000).toLocaleString()}k tokens/day`;

const formatCount = (n: number): string => (n <= 0 ? 'Unlimited' : n.toLocaleString());

export default function PlanScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanKey | 'portal' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [p, m] = await Promise.allSettled([billingService.getPlans(), billingService.getMyPlan()]);
    if (p.status === 'fulfilled') setPlans(p.value.data?.data ?? []);
    if (m.status === 'fulfilled') setMine(m.value.data?.data ?? null);
    setLoading(false);
  }, []);

  // Wrapped so every setState lands in an async continuation rather than the effect body. Each
  // `load` begins with an await, so nothing was setting state synchronously anyway — this just
  // makes that visible to the compiler's effect analysis.
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  /**
   * Checkout happens in the system browser rather than a WebView.
   *
   * Payment pages routinely refuse to render inside an embedded browser, and putting a card form in
   * one we control is exactly the pattern users are taught to distrust. The session URL is
   * short-lived and single-use, so handing it to the OS browser is safe.
   */
  const openExternal = async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
    // The subscription changes on Stripe's side, so re-read rather than assume it succeeded.
    await load();
  };

  const upgrade = async (planKey: PlanKey) => {
    setBusy(planKey);
    setError('');
    try {
      const res = await billingService.startCheckout(planKey, 'studyplatform://settings/plan', 'studyplatform://settings/plan');
      const url = res.data?.data?.url;
      if (url) await openExternal(url);
      else setError('Could not start checkout. Please try again.');
    } catch {
      setError('Could not start checkout. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('portal');
    setError('');
    try {
      const res = await billingService.openPortal('studyplatform://settings/plan');
      const url = res.data?.data;
      if (url) await openExternal(url);
      else setError('Could not open the billing portal.');
    } catch {
      setError('Could not open the billing portal.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const usageRatio =
    mine && mine.dailyTokenLimit > 0 ? Math.min(1, mine.tokensUsedToday / mine.dailyTokenLimit) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {mine && (
        <Card style={styles.card}>
          <View style={styles.planHeader}>
            <View style={styles.flex}>
              <Text style={styles.planName}>{mine.plan.displayName}</Text>
              {mine.source === 'organization' && (
                <Text style={styles.caption}>via your organization</Text>
              )}
              {!!mine.expiresAt && (
                <Text style={styles.caption}>
                  {mine.status === 'cancelled' ? 'Access ends' : 'Renews'}{' '}
                  {new Date(mine.expiresAt).toLocaleDateString()}
                </Text>
              )}
              {mine.status === 'past_due' && (
                <Text style={styles.warning}>Payment failed — update your card to keep access.</Text>
              )}
            </View>

            {mine.canManageBilling && (
              <Pressable onPress={manage} disabled={busy !== null} style={styles.manageButton}>
                {busy === 'portal' ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <ExternalLink size={14} color={Colors.primary} />
                )}
                <Text style={styles.manageText}>Manage</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.usageBlock}>
            <View style={styles.usageRow}>
              <Text style={styles.caption}>AI usage today</Text>
              <Text style={styles.caption}>
                {mine.tokensUsedToday.toLocaleString()} /{' '}
                {mine.dailyTokenLimit > 0 ? mine.dailyTokenLimit.toLocaleString() : '∞'}
              </Text>
            </View>
            {mine.dailyTokenLimit > 0 && (
              <ProgressBar progress={usageRatio} color={usageRatio >= 0.9 ? Colors.red : Colors.primary} />
            )}
            <Text style={styles.caption}>Resets at midnight UTC.</Text>
          </View>
        </Card>
      )}

      {/* Hidden entirely when no payment processor is configured — a self-hosted install has
          nothing to upgrade to, and showing prices there would be a lie. */}
      {mine?.billingEnabled && (
        <View style={styles.plans}>
          <Text style={styles.sectionLabel}>Available plans</Text>
          {plans.map((plan) => {
            const isCurrent = plan.key === mine.plan.key;
            return (
              <Card key={plan.key} style={[styles.card, isCurrent && styles.currentCard]}>
                <Text style={styles.planName}>{plan.displayName}</Text>
                <Text style={styles.price}>
                  ${plan.monthlyPriceUsd}
                  <Text style={styles.caption}> /mo</Text>
                </Text>

                <View style={styles.features}>
                  <Feature text={formatLimit(plan.dailyTokenLimit)} />
                  <Feature text={`${formatCount(plan.maxClassrooms)} classrooms`} />
                  <Feature text={`${formatCount(plan.maxStudentsPerClassroom)} students per class`} />
                  {plan.includesHostedKeys && <Feature text="AI key included — no setup" />}
                </View>

                <Pressable
                  onPress={() => upgrade(plan.key)}
                  disabled={isCurrent || plan.key === 'free' || busy !== null}
                  style={[
                    styles.upgradeButton,
                    (isCurrent || plan.key === 'free') && styles.upgradeButtonDisabled,
                  ]}
                >
                  <Text style={styles.upgradeText}>
                    {isCurrent ? 'Current plan' : busy === plan.key ? 'Opening…' : 'Upgrade'}
                  </Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const Feature: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.feature}>
    <Check size={14} color={Colors.primary} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },
  card: { padding: Spacing.three, gap: Spacing.two },
  currentCard: { borderColor: Colors.primary, borderWidth: 1 },
  flex: { flex: 1 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  planName: { ...Typography.subheading, color: Colors.textPrimary },
  price: { ...Typography.title, color: Colors.textPrimary },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  warning: { ...Typography.caption, color: Colors.amber, marginTop: 2 },
  error: { ...Typography.caption, color: Colors.red },
  manageButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  manageText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  usageBlock: { gap: Spacing.one, marginTop: Spacing.one },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  plans: { gap: Spacing.two },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  features: { gap: 4, marginTop: Spacing.one },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  featureText: { ...Typography.caption, color: Colors.textSecondary },
  upgradeButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  upgradeButtonDisabled: { backgroundColor: Colors.border },
  upgradeText: { ...Typography.bodyBold, color: Colors.white },
});

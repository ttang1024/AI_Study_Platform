import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import History from 'lucide-react-native/icons/history';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { securityService, type AuditEntry } from '@/services/securityService';

/**
 * Plain-English labels for the action keys. A map rather than a formatter, because these are read
 * by someone checking whether their account was touched — "auth.2fa.recovery_used" answers that
 * far worse than "Recovery code used".
 */
const ACTION_LABELS: Record<string, string> = {
  'auth.login.succeeded': 'Signed in',
  'auth.login.failed': 'Failed sign-in attempt',
  'auth.logout.all': 'Signed out other devices',
  'auth.password.changed': 'Password changed',
  'auth.password.reset': 'Password reset',
  'auth.2fa.enabled': 'Two-factor turned on',
  'auth.2fa.disabled': 'Two-factor turned off',
  'auth.2fa.failed': 'Failed two-factor code',
  'auth.2fa.recovery_used': 'Recovery code used',
  'auth.2fa.recovery_regenerated': 'New recovery codes generated',
  'auth.session.revoked': 'Device signed out',
  'account.export.requested': 'Data export requested',
  'account.export.downloaded': 'Data export downloaded',
  'account.deletion.requested': 'Account deletion requested',
  'account.deletion.cancelled': 'Account deletion cancelled',
  'apikey.created': 'API key created',
  'apikey.revoked': 'API key revoked',
  'webhook.created': 'Webhook added',
  'webhook.deleted': 'Webhook removed',
  'admin.user.viewed': 'An administrator viewed your account',
};

/** Actions worth drawing the eye to when someone is scanning for trouble. */
const ALARMING = new Set([
  'auth.login.failed',
  'auth.2fa.failed',
  'auth.2fa.disabled',
  'auth.2fa.recovery_used',
  'admin.user.viewed',
]);

export default function SecurityLogScreen() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const res = await securityService.getAuditLog(nextPage, 25);
      setEntries(res.data.data.items);
      setHasNext(res.data.data.hasNextPage);
      setPage(res.data.data.page);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load(1);
    })();
  }, [load]);

  if (entries === null) {
    return (
      <View style={Layout.fillCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <History size={22} color={Colors.primary} />
        <Text style={styles.title}>Security log</Text>
      </View>
      <Text style={styles.subtitle}>Sign-ins and changes to your account, newest first.</Text>

      {entries.length === 0 ? (
        <EmptyState icon={History} title="Nothing recorded yet" />
      ) : (
        <>
          {entries.map((entry) => (
            <Card key={entry.auditLogEntryId} style={styles.card}>
              <Text style={[styles.action, ALARMING.has(entry.action) && styles.actionAlarming]}>
                {ACTION_LABELS[entry.action] ?? entry.action}
              </Text>
              <Text style={styles.meta}>
                {new Date(entry.createdAt).toLocaleString()}
                {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
              </Text>
            </Card>
          ))}

          <View style={styles.pager}>
            <Button
              title="Previous"
              variant="secondary"
              onPress={() => load(page - 1)}
              disabled={page <= 1 || loading}
            />
            <Button
              title="Next"
              variant="secondary"
              onPress={() => load(page + 1)}
              disabled={!hasNext || loading}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  header: { ...Layout.row, gap: Spacing.two },
  title: { ...Typography.heading, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.two },
  card: { gap: Spacing.one },
  action: { ...Typography.body, color: Colors.textPrimary },
  actionAlarming: { color: Colors.amber, fontWeight: '700' },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  pager: { ...Layout.row, gap: Spacing.two, marginTop: Spacing.three },
});

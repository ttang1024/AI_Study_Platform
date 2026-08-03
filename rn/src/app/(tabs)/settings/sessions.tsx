import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import MonitorSmartphone from 'lucide-react-native/icons/monitor-smartphone';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { securityService, type ActiveSession } from '@/services/securityService';
import { tokenStore } from '@/services/tokenStore';
import { getApiErrorMessage } from '@/utils/apiError';

const formatWhen = (iso: string | null): string => {
  if (!iso) return 'unknown';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
};

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      // Native clients have no cookie, so the refresh token is passed explicitly — it is the only
      // way the server can tell which row is this phone.
      const refreshToken = await tokenStore.getRefreshToken();
      const res = await securityService.getSessions(refreshToken ?? undefined);
      setSessions(res.data.data);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const revoke = async (sessionId: string) => {
    setBusyId(sessionId); setError('');
    try {
      await securityService.revokeSession(sessionId);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not sign that device out.'));
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setBusyId('others'); setError('');
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      await securityService.revokeOtherSessions(refreshToken ?? undefined);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not sign the other devices out.'));
    } finally {
      setBusyId(null);
    }
  };

  if (sessions === null) {
    return (
      <View style={Layout.fillCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MonitorSmartphone size={22} color={Colors.primary} />
        <Text style={styles.title}>Active sessions</Text>
      </View>
      <Text style={styles.subtitle}>
        Everywhere you&apos;re signed in. Sign out anything you don&apos;t recognise.
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {sessions.length === 0 ? (
        <EmptyState icon={MonitorSmartphone} title="No active sessions" />
      ) : (
        sessions.map((session) => (
          <Card key={session.sessionId} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.device}>{session.deviceName ?? 'Unknown device'}</Text>
              {session.isCurrent && <Text style={styles.badge}>This device</Text>}
            </View>
            <Text style={styles.meta}>
              {session.ipAddress ?? 'unknown IP'} · signed in{' '}
              {new Date(session.startedAt).toLocaleDateString()} · last active{' '}
              {formatWhen(session.lastUsedAt)}
            </Text>
            {/* The current session is ended by signing out, not from this list — a button here that
                logs you out mid-audit reads as a bug rather than an action. */}
            {!session.isCurrent && (
              <Button
                title="Sign out"
                variant="danger"
                onPress={() => revoke(session.sessionId)}
                loading={busyId === session.sessionId}
              />
            )}
          </Card>
        ))
      )}

      {otherCount > 0 && (
        <Button
          title={`Sign out ${otherCount} other device${otherCount === 1 ? '' : 's'}`}
          variant="danger"
          onPress={revokeOthers}
          loading={busyId === 'others'}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  header: { ...Layout.row, gap: Spacing.two },
  title: { ...Typography.heading, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
  card: { gap: Spacing.two },
  rowBetween: { ...Layout.rowBetween },
  device: { ...Typography.bodyBold, color: Colors.textPrimary, flexShrink: 1 },
  badge: {
    ...Typography.captionBold,
    color: Colors.primary,
    backgroundColor: `${Colors.primary}1a`,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  error: { ...Typography.caption, color: Colors.errorText },
});

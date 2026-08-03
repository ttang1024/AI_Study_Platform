import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import FileArchive from 'lucide-react-native/icons/file-archive';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  securityService,
  type DataExport,
} from '@/services/securityService';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatBytes } from '@core/utils/format';

/** Exports are built by a worker, so the list polls while anything is in flight. */
const POLL_INTERVAL_MS = 5000;

export default function DataRightsScreen() {
  const [exports, setExports] = useState<DataExport[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await securityService.getExports();
      setExports(res.data.data);
    } catch {
      setExports([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // Polls only while something is being built, and stops as soon as nothing is — a permanent timer
  // on a settings screen is a background request every few seconds forever.
  useEffect(() => {
    const pending = (exports ?? []).some((e) => e.status === 'Pending' || e.status === 'Running');
    if (!pending) return;
    const timer = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [exports, load]);

  const request = async () => {
    setBusy(true); setError('');
    try {
      await securityService.requestExport();
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start the export.'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (id: string) => {
    setError('');
    try {
      const res = await securityService.getExportDownloadUrl(id);
      // Opened in the system browser rather than fetched: the signed URL points straight at
      // storage, and the browser handles a multi-hundred-megabyte download far better than the app.
      await WebBrowser.openBrowserAsync(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'That download is no longer available.'));
    }
  };

  const requestDeletion = async () => {
    setDeleting(true); setError('');
    try {
      const res = await securityService.requestAccountDeletion(password, confirmation);
      setScheduledFor(res.data.data);
      setPassword(''); setConfirmation('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not schedule deletion.'));
    } finally {
      setDeleting(false);
    }
  };

  if (exports === null) {
    return (
      <View style={Layout.fillCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <FileArchive size={22} color={Colors.primary} />
        <Text style={styles.title}>Download your data</Text>
      </View>
      <Text style={styles.subtitle}>
        A ZIP of everything we hold on you — library, notes, flashcards, review history and more.
        Large libraries take a few minutes.
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button title="Request an export" onPress={request} loading={busy} />

      {exports.map((item) => (
        <Card key={item.dataExportRequestId} style={styles.card}>
          <Text style={styles.cardTitle}>{new Date(item.createdAt).toLocaleString()}</Text>
          <Text style={styles.meta}>
            {item.status === 'Completed'
              ? `Ready${item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ''}${
                  item.expiresAt ? ` · expires ${new Date(item.expiresAt).toLocaleDateString()}` : ''
                }`
              : item.status === 'Failed'
                ? item.errorMessage ?? 'Failed'
                : 'Preparing…'}
          </Text>
          {item.isDownloadable && (
            <Button
              title="Download"
              variant="secondary"
              onPress={() => download(item.dataExportRequestId)}
            />
          )}
        </Card>
      ))}

      <View style={[styles.header, styles.dangerHeader]}>
        <TriangleAlert size={22} color={Colors.errorText} />
        <Text style={styles.dangerTitle}>Delete your account</Text>
      </View>
      <Text style={styles.subtitle}>
        You&apos;ll be signed out immediately. Your data is kept for 7 days in case you change your
        mind — log in during that window to cancel. After that it&apos;s gone for good.
      </Text>

      {scheduledFor ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>
            Scheduled for {new Date(scheduledFor).toLocaleDateString()}
          </Text>
          <Text style={styles.meta}>Log in before then to cancel.</Text>
        </Card>
      ) : (
        <Card style={styles.card}>
          <TextField label="Your password" value={password} onChangeText={setPassword} secureToggle />
          <TextField
            label={`Type "${ACCOUNT_DELETION_CONFIRMATION}" to confirm`}
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
          />
          <Button
            title="Delete my account"
            variant="danger"
            onPress={requestDeletion}
            loading={deleting}
            disabled={!password || confirmation.trim() !== ACCOUNT_DELETION_CONFIRMATION}
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  header: { ...Layout.row, gap: Spacing.two },
  dangerHeader: { marginTop: Spacing.four },
  title: { ...Typography.heading, color: Colors.textPrimary },
  dangerTitle: { ...Typography.heading, color: Colors.errorText },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
  card: { gap: Spacing.two },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  error: { ...Typography.caption, color: Colors.errorText },
});

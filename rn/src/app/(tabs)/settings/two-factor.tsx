import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { securityService, type TwoFactorStatus } from '@/services/securityService';
import { getApiErrorMessage } from '@/utils/apiError';

/**
 * Enrolment is three states, not a form: off, mid-setup (secret issued, not yet proven), and on.
 * Modelled explicitly because the middle one is the only time the secret exists on the device.
 */
type Stage = 'loading' | 'off' | 'enrolling' | 'on';

const RECOVERY_WARNING_THRESHOLD = 3;

export default function TwoFactorScreen() {
  const [stage, setStage] = useState<Stage>('loading');
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [secret, setSecret] = useState('');
  const [otpAuthUri, setOtpAuthUri] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await securityService.getTwoFactorStatus();
      const next = res.data.data;
      setStatus(next);
      setStage(next.enabled ? 'on' : 'off');
    } catch {
      setStage('off');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const startSetup = async () => {
    setBusy(true); setError('');
    try {
      const res = await securityService.startTwoFactorSetup();
      setSecret(res.data.data.secret);
      setOtpAuthUri(res.data.data.otpAuthUri);
      setStage('enrolling');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start setup.'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Hands the otpauth:// URI to whatever authenticator is installed.
   *
   * On a phone the authenticator is usually on this same device, so a deep link beats the QR code
   * the web app shows — you cannot scan your own screen. The secret is still shown below for
   * anyone whose authenticator lives elsewhere.
   */
  const openInAuthenticator = async () => {
    const opened = await Linking.openURL(otpAuthUri).then(() => true).catch(() => false);
    if (!opened) {
      Alert.alert(
        'No authenticator app found',
        'Copy the setup key below and add it manually in your authenticator.',
      );
    }
  };

  const confirm = async () => {
    setBusy(true); setError('');
    try {
      const res = await securityService.confirmTwoFactor(code);
      setRecoveryCodes(res.data.data.recoveryCodes);
      // Cleared as soon as it is proven stored — no reason for the secret to stay in state.
      setSecret(''); setOtpAuthUri(''); setCode('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'That code was not accepted.'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true); setError('');
    try {
      await securityService.disableTwoFactor(password);
      setPassword(''); setRecoveryCodes(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not turn off two-factor authentication.'));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true); setError('');
    try {
      const res = await securityService.regenerateRecoveryCodes(password);
      setRecoveryCodes(res.data.data.recoveryCodes);
      setPassword('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate new recovery codes.'));
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'loading') {
    return (
      <View style={Layout.fillCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ShieldCheck size={22} color={Colors.primary} />
        <Text style={styles.title}>Two-factor authentication</Text>
      </View>
      <Text style={styles.subtitle}>
        Ask for a code from your authenticator app as well as your password.
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {recoveryCodes && (
        <Card style={styles.warnCard}>
          <View style={styles.header}>
            <TriangleAlert size={18} color={Colors.amber} />
            <Text style={styles.warnTitle}>Save these recovery codes</Text>
          </View>
          <Text style={styles.warnBody}>
            Each one signs you in once if you lose your authenticator. They will not be shown again.
          </Text>
          <View style={styles.codeGrid}>
            {recoveryCodes.map((rc) => (
              <Text key={rc} style={styles.recoveryCode}>{rc}</Text>
            ))}
          </View>
          <Button
            title="Copy all"
            variant="secondary"
            onPress={() => Clipboard.setStringAsync(recoveryCodes.join('\n'))}
          />
        </Card>
      )}

      {stage === 'off' && (
        <Button title="Set up two-factor authentication" onPress={startSetup} loading={busy} />
      )}

      {stage === 'enrolling' && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>1. Add it to your authenticator</Text>
          <Button title="Open in authenticator app" onPress={openInAuthenticator} />
          <Text style={styles.label}>Or add this key manually:</Text>
          <Text selectable style={styles.secret}>{secret}</Text>
          <Button
            title="Copy key"
            variant="secondary"
            onPress={() => Clipboard.setStringAsync(secret)}
          />

          <Text style={styles.cardTitle}>2. Enter the code it shows</Text>
          <TextField
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="123456"
            maxLength={7}
          />
          <Button
            title="Turn it on"
            onPress={confirm}
            loading={busy}
            disabled={code.replace(/\D/g, '').length !== 6}
          />
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => { setStage('off'); setSecret(''); setOtpAuthUri(''); setCode(''); }}
          />
        </Card>
      )}

      {stage === 'on' && (
        <Card style={styles.card}>
          <Text
            style={[
              styles.label,
              (status?.recoveryCodesRemaining ?? 0) <= RECOVERY_WARNING_THRESHOLD && styles.labelWarn,
            ]}
          >
            {status?.recoveryCodesRemaining ?? 0} recovery code
            {status?.recoveryCodesRemaining === 1 ? '' : 's'} left.
            {(status?.recoveryCodesRemaining ?? 0) <= RECOVERY_WARNING_THRESHOLD
              ? ' Generate a new set soon.'
              : ''}
          </Text>

          <TextField
            label="Confirm your password to make changes"
            value={password}
            onChangeText={setPassword}
            secureToggle
          />
          <Button
            title="New recovery codes"
            variant="secondary"
            onPress={regenerate}
            loading={busy}
            disabled={!password}
          />
          <Button
            title="Turn off"
            variant="danger"
            onPress={disable}
            loading={busy}
            disabled={!password}
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
  title: { ...Typography.heading, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
  card: { gap: Spacing.two },
  cardTitle: { ...Typography.subheading, color: Colors.textPrimary, marginTop: Spacing.two },
  label: { ...Typography.caption, color: Colors.textSecondary },
  labelWarn: { color: Colors.amber, fontWeight: '700' },
  secret: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgApp,
    padding: Spacing.two,
    borderRadius: Radius.sm,
  },
  warnCard: { gap: Spacing.two, borderColor: Colors.amber, borderWidth: 1 },
  warnTitle: { ...Typography.subheading, color: Colors.textPrimary },
  warnBody: { ...Typography.caption, color: Colors.textSecondary },
  codeGrid: { ...Layout.rowWrap, gap: Spacing.two },
  recoveryCode: { fontFamily: 'monospace', fontSize: 13, color: Colors.textPrimary, width: '45%' },
  error: { ...Typography.caption, color: Colors.errorText },
});

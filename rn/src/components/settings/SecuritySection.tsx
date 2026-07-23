import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern';

import { IconBadge } from '@/components/IconBadge';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/theme';
import {
  authenticateForUnlock,
  biometricLabel,
  canUseAppLock,
  isAppLockEnabled,
  setAppLockEnabled,
} from '@/services/appLock';

// Settings → biometric app lock toggle. Enabling runs one authentication up
// front so the user proves the unlock works before it starts gating launches.
export function SecuritySection() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState('Biometrics');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isAppLockEnabled().then(setEnabled);
    canUseAppLock().then(setAvailable);
    biometricLabel().then(setLabel);
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        if (!(await canUseAppLock())) {
          Alert.alert('Not available', 'Set up a device passcode or biometrics in system Settings first.');
          return;
        }
        if (!(await authenticateForUnlock())) return;
        await setAppLockEnabled(true);
        setEnabled(true);
      } else {
        await setAppLockEnabled(false);
        setEnabled(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <IconBadge icon={Fingerprint} size={36} />
      <View style={styles.body}>
        <Text style={styles.title}>App lock</Text>
        <Text style={styles.subtitle}>
          {available
            ? `Require ${label} or your passcode when the app opens`
            : 'Needs a device passcode or biometrics set up in system Settings'}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={toggle}
        disabled={busy || (!available && !enabled)}
        trackColor={{ true: Colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...Layout.row, gap: Spacing.three,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.three,
    ...Shadows.card,
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});

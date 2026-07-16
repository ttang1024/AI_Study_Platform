import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Alpha, Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { authenticateForUnlock, isAppLockEnabled } from '@/services/appLock';

// Blocks the whole app behind Face ID / Touch ID when the lock is enabled in
// Settings → Security: on cold start and again whenever the app comes back
// from the background. Relocking keys off 'background' only — the biometric
// sheet itself puts iOS apps in 'inactive', which must not re-trigger a lock.
export function AppLockGate({ children }: { children: React.ReactNode }) {
  // null = still reading the preference; render nothing rather than flash content.
  const [locked, setLocked] = useState<boolean | null>(null);
  const promptInFlight = useRef(false);

  const promptUnlock = useCallback(async () => {
    if (promptInFlight.current) return;
    promptInFlight.current = true;
    try {
      if (await authenticateForUnlock()) setLocked(false);
    } finally {
      promptInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    isAppLockEnabled().then((enabled) => {
      setLocked(enabled);
      if (enabled) promptUnlock();
    });
  }, [promptUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background' && (await isAppLockEnabled())) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  if (locked === null) return null;
  if (!locked) return <>{children}</>;

  return (
    <View style={styles.root}>
      <View style={styles.iconCircle}>
        <LockKeyhole size={30} color={Colors.primary} />
      </View>
      <Text style={styles.title}>toto.ai is locked</Text>
      <Text style={styles.subtitle}>Unlock with biometrics or your device passcode.</Text>
      <Button title="Unlock" onPress={promptUnlock} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...Layout.fillCenter, backgroundColor: Colors.bgApp, gap: Spacing.three, padding: Spacing.five,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: `${Colors.primary}${Alpha.tint}`,
    ...Layout.center,
  },
  title: { ...Typography.heading, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
});

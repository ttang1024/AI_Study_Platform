import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

// Biometric app lock: an opt-in Face ID / Touch ID / fingerprint gate shown on
// cold start and whenever the app returns from the background (AppLockGate).
// The preference is a plain device-local flag — it protects screen access, not
// the auth token, so AsyncStorage (not SecureStore) is the right home.
const ENABLED_KEY = 'settings.appLockEnabled';

export async function isAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
  } catch { /* best-effort; worst case the toggle doesn't stick */ }
}

/** Whether this device can actually enforce the lock (hardware + enrolled biometrics/passcode). */
export async function canUseAppLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    // authenticateAsync falls back to the device passcode, so enrollment of
    // biometrics specifically isn't required — but *some* secure lock is.
    return hasHardware || enrolled || (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Human label for the settings row ("Face ID", "Touch ID", "Biometrics"). */
export async function biometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
  } catch { /* fall through */ }
  return 'Biometrics';
}

/** Prompt the system unlock sheet. Resolves true when the user authenticated. */
export async function authenticateForUnlock(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock toto.ai',
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
}

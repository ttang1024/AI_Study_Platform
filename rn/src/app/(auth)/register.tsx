import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { SocialLoginButtons } from '@/components/SocialLoginButtons';
import { TextField } from '@/components/TextField';
import { AuthScaffold, authFormStyles } from '@/components/auth/AuthScaffold';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/utils/apiError';
import { validatePassword } from '@/utils/validatePassword';

export default function RegisterScreen() {
  const { register, sendOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordValid = validatePassword(password);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const onSendOtp = async () => {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setError(null);
    setSendingOtp(true);
    try {
      await sendOtp(email.trim(), 'registration');
      setCountdown(60);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the code. Check your email and try again.'));
    } finally {
      setSendingOtp(false);
    }
  };

  const onSubmit = async () => {
    if (!email.trim() || !name.trim() || !password || !otpCode.trim()) {
      setError('Fill in every field, including the emailed code.');
      return;
    }
    if (!passwordValid) {
      setError('Password needs 8-20 characters and 3 of: upper, lower, number, symbol.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({ email: email.trim(), fullName: name.trim(), password, otpCode: otpCode.trim() });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed. Double-check the code and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScaffold
      title="Create your account"
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerHref="/(auth)/login"
    >
      <SocialLoginButtons onError={setError} />
      <View style={authFormStyles.form}>
        <TextField label="Full name" value={name} onChangeText={setName} placeholder="Ada Lovelace" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureToggle
          placeholder="••••••••"
          variant={password ? (passwordValid ? 'valid' : 'invalid') : 'default'}
        />
        {!!password && !passwordValid && (
          <View style={authFormStyles.hint}>
            <Info size={13} color={Colors.teal} style={authFormStyles.hintIcon} />
            <Text style={authFormStyles.hintText}>8-20 characters, 3 of: upper, lower, number, symbol.</Text>
          </View>
        )}

        <View style={styles.otpRow}>
          <View style={styles.otpInput}>
            <TextField label="Verification code" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" placeholder="123456" />
          </View>
          <Button
            title={countdown > 0 ? `Resend (${countdown}s)` : 'Send code'}
            variant="secondary"
            onPress={onSendOtp}
            disabled={countdown > 0}
            loading={sendingOtp}
          />
        </View>

        {error && <Text style={authFormStyles.error}>{error}</Text>}
        <Button title="Create Account" onPress={onSubmit} loading={submitting} />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  otpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  otpInput: { flex: 1 },
});

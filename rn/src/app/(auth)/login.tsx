import { useState } from 'react';
import { Text, View } from 'react-native';
import Info from 'lucide-react-native/icons/info';

import { Button } from '@/components/Button';
import { SocialLoginButtons } from '@/components/SocialLoginButtons';
import { TextField } from '@/components/TextField';
import { AuthScaffold, authFormStyles as styles } from '@/components/auth/AuthScaffold';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/utils/apiError';
import { validatePassword } from '@/utils/validatePassword';

export default function LoginScreen() {
  const { login, verifyTwoFactor } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set when the password leg passed but a second factor is owed. Its presence is what swaps the
  // form over — no separate mode flag to keep in step with it.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const passwordValid = validatePassword(password);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!passwordValid) {
      setError('Password needs 8-20 characters and 3 of: upper, lower, number, symbol.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const outcome = await login(email.trim(), password);
      if (outcome.status === 'pending2fa') setChallengeToken(outcome.challengeToken);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitCode = async () => {
    if (!challengeToken || !twoFactorCode.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyTwoFactor(challengeToken, twoFactorCode.trim());
    } catch (err) {
      // A challenge lives five minutes and is burned on use, so an expired one has to send the
      // user back to the password form rather than leaving them retyping at a dead handle.
      const message = getApiErrorMessage(err, 'That code was not accepted.');
      if (message.toLowerCase().includes('expired')) {
        setChallengeToken(null);
        setTwoFactorCode('');
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (challengeToken) {
    return (
      <AuthScaffold
        title="Two-factor authentication"
        footerText="Wrong account?"
        footerLinkText="Start over"
        footerHref="/(auth)/login"
      >
        <View style={styles.form}>
          <Text style={styles.hintText}>
            Enter the code from your authenticator app, or one of your recovery codes.
          </Text>
          <TextField
            label="Code"
            value={twoFactorCode}
            onChangeText={setTwoFactorCode}
            placeholder="123456"
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Verify" onPress={onSubmitCode} loading={submitting} />
        </View>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Welcome back"
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerHref="/(auth)/register"
    >
      <SocialLoginButtons onError={setError} />
      <View style={styles.form}>
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
          <View style={styles.hint}>
            <Info size={13} color={Colors.teal} style={styles.hintIcon} />
            <Text style={styles.hintText}>8-20 characters, 3 of: upper, lower, number, symbol.</Text>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Sign In" onPress={onSubmit} loading={submitting} />
      </View>
    </AuthScaffold>
  );
}

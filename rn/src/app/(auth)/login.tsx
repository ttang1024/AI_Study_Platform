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
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      await login(email.trim(), password);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

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

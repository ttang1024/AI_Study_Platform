import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/PressableScale';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { OAuthProvider, useOAuthLogin } from '@/hooks/useOAuthLogin';
import { getApiErrorMessage } from '@/utils/apiError';

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
};

interface SocialLoginButtonsProps {
  onError: (message: string) => void;
}

export function SocialLoginButtons({ onError }: SocialLoginButtonsProps) {
  const { loginWithOAuth } = useAuth();
  const google = useOAuthLogin('google');
  const github = useOAuthLogin('github');
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  if (!google.isConfigured && !github.isConfigured) return null;

  const handlePress = async (provider: OAuthProvider) => {
    if (pending) return;
    const { promptAsync } = provider === 'google' ? google : github;
    setPending(provider);
    try {
      const result = await promptAsync();
      if (!result) return;
      await loginWithOAuth(provider, result.code, result.redirectUri);
    } catch (err) {
      onError(getApiErrorMessage(err, `Could not sign in with ${PROVIDER_LABEL[provider]}.`));
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.container}>
      {google.isConfigured && (
        <PressableScale
          style={styles.button}
          onPress={() => handlePress('google')}
          disabled={pending !== null}
        >
          {pending === 'google' ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <>
              <GoogleIcon />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </>
          )}
        </PressableScale>
      )}
      {github.isConfigured && (
        <PressableScale
          style={styles.button}
          onPress={() => handlePress('github')}
          disabled={pending !== null}
        >
          {pending === 'github' ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <>
              <GitHubIcon />
              <Text style={styles.buttonText}>Continue with GitHub</Text>
            </>
          )}
        </PressableScale>
      )}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        d="M47.532 24.552c0-1.636-.145-3.2-.415-4.695H24.48v9.013h12.971c-.56 2.98-2.24 5.507-4.77 7.198v5.984h7.72c4.516-4.16 7.131-10.29 7.131-17.5z"
        fill="#4285F4"
      />
      <Path
        d="M24.48 48c6.51 0 11.97-2.156 15.96-5.848l-7.72-5.984c-2.148 1.44-4.896 2.293-8.24 2.293-6.333 0-11.695-4.277-13.613-10.02H3.052v6.181C7.023 42.874 15.175 48 24.48 48z"
        fill="#34A853"
      />
      <Path
        d="M10.867 28.441A14.498 14.498 0 0 1 9.9 24c0-1.54.267-3.035.737-4.441v-6.181H3.052A23.984 23.984 0 0 0 .48 24c0 3.87.93 7.532 2.572 10.622l7.815-6.181z"
        fill="#FBBC05"
      />
      <Path
        d="M24.48 9.539c3.567 0 6.768 1.226 9.285 3.636l6.958-6.958C36.437 2.39 30.987 0 24.48 0 15.175 0 7.023 5.126 3.052 13.378l7.815 6.181C12.785 13.816 18.147 9.54 24.48 9.54z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function GitHubIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#1f2937"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, marginBottom: Spacing.two },
  button: {
    ...Layout.row,
    justifyContent: 'center',
    gap: Spacing.two,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  dividerRow: { ...Layout.row, gap: Spacing.two, marginTop: Spacing.one },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
});

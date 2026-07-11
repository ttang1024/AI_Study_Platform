import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';

import { GITHUB_CLIENT_ID, GOOGLE_CLIENT_ID } from '@/constants/env';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'github';

const DISCOVERY: Record<OAuthProvider, AuthSession.DiscoveryDocument> = {
  google: { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' },
  github: { authorizationEndpoint: 'https://github.com/login/oauth/authorize' },
};

const SCOPES: Record<OAuthProvider, string[]> = {
  google: ['openid', 'email', 'profile'],
  github: ['read:user', 'user:email'],
};

const CLIENT_IDS: Record<OAuthProvider, string | undefined> = {
  google: GOOGLE_CLIENT_ID,
  github: GITHUB_CLIENT_ID,
};

export interface OAuthCodeResult {
  code: string;
  redirectUri: string;
}

// The backend exchanges the code with a confidential client secret (see
// OAuthService.cs), not a PKCE verifier, so this must request a plain code.
export function useOAuthLogin(provider: OAuthProvider) {
  const clientId = CLIENT_IDS[provider];

  const promptAsync = useCallback(async (): Promise<OAuthCodeResult | null> => {
    if (!clientId) return null;

    const redirectUri = AuthSession.makeRedirectUri({ path: 'oauth-redirect' });
    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      scopes: SCOPES[provider],
      usePKCE: false,
    });
    const result = await request.promptAsync(DISCOVERY[provider]);
    if (result.type !== 'success' || !result.params.code) return null;

    return { code: result.params.code, redirectUri };
  }, [clientId, provider]);

  return { promptAsync, isConfigured: !!clientId };
}

import { useEffect, useRef, useState } from 'react';
import { useOptionalAuth } from '../context/AuthContext';
import { getPublicEnv } from '../utils/env';

const GOOGLE_CLIENT_ID = getPublicEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID') ?? getPublicEnv('VITE_GOOGLE_CLIENT_ID');
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: 'signin' | 'signup' | 'use';
            itp_support?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: () => void;
          cancel?: () => void;
        };
      };
    };
  }
}

/** Loads the Google Identity script and shows the One Tap sign-in prompt for signed-out visitors. */
export function useGoogleOneTap() {
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const isAuthLoading = auth?.isLoading ?? false;
  const [googleError, setGoogleError] = useState<string | null>(null);
  const oneTapInitialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      window.google?.accounts.id.cancel?.();
      return;
    }

    if (isAuthLoading || !GOOGLE_CLIENT_ID || !auth?.loginWithGoogleCredential) return;

    let shouldPrompt = true;

    const initializeGoogleSignIn = () => {
      if (!shouldPrompt || !window.google || oneTapInitialized.current || auth.isAuthenticated) return;
      oneTapInitialized.current = true;

      const handleCredential = ({ credential }: { credential?: string }) => {
        if (!credential) return;
        auth.loginWithGoogleCredential(credential)
          .then(() => window.location.assign('/library/add'))
          .catch(() => setGoogleError('Google sign-in failed. Please try again.'));
      };

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
        use_fedcm_for_prompt: true,
      });

      window.google.accounts.id.prompt();
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      if (window.google) initializeGoogleSignIn();
      else existingScript.addEventListener('load', initializeGoogleSignIn, { once: true });
      return () => {
        shouldPrompt = false;
        existingScript.removeEventListener('load', initializeGoogleSignIn);
      };
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    script.onerror = () => setGoogleError('Google sign-in is unavailable right now.');
    document.head.appendChild(script);
    return () => {
      shouldPrompt = false;
    };
  }, [auth, isAuthenticated, isAuthLoading]);

  return { googleError };
}

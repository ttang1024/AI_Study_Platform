import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

export const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state'); // provider name: "google" or "github"
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Authentication was cancelled or failed. Please try again.');
      return;
    }

    if (!code || !state) {
      setError('Invalid OAuth callback. Missing code or provider.');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;

    loginWithOAuth(state, code, redirectUri)
      .then(() => navigate('/library?view=add', { replace: true }))
      .catch((err: any) => {
        setError(err?.response?.data?.message || 'Authentication failed. Please try again.');
      });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-xl text-center space-y-4"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Authentication Failed</h2>
          <p className="text-sm text-zinc-500">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          animate={{ rotate: [0, 10, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative h-16 w-16 overflow-hidden rounded-2xl"
        >
          <img src="/app.png" alt="toto.ai logo" className="h-full w-full object-cover" />
        </motion.div>
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:-0.3s]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-300 [animation-delay:-0.15s]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
          </div>
          <p className="text-zinc-500 text-sm">Completing sign-in…</p>
        </div>
      </motion.div>
    </div>
  );
};

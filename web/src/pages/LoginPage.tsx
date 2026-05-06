import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldAlert, Info, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { cn } from '../utils/cn';
import { getPublicEnv } from '../utils/env';

const GOOGLE_CLIENT_ID = getPublicEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID') ?? getPublicEnv('VITE_GOOGLE_CLIENT_ID');
const GITHUB_CLIENT_ID = getPublicEnv('NEXT_PUBLIC_GITHUB_CLIENT_ID') ?? getPublicEnv('VITE_GITHUB_CLIENT_ID');

function buildOAuthUrl(provider: 'google' | 'github'): string {
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
  if (provider === 'google') {
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&scope=email%20profile&response_type=code&state=google`;
  }
  return `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=read:user%20user:email&state=github`;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, sendOtp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePassword = (pass: string) => {
    if (pass.length < 8 || pass.length > 20) return false;
    let types = 0;
    if (/[A-Z]/.test(pass)) types++;
    if (/[a-z]/.test(pass)) types++;
    if (/[0-9]/.test(pass)) types++;
    if (/[^A-Za-z0-9]/.test(pass)) types++;
    return types >= 3;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isForgotPassword && !isVerifyingCode) {
      setIsSubmitting(true);
      try {
        await sendOtp(email, 'passwordReset');
        setIsVerifyingCode(true);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to send reset code. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isVerifyingCode) {
      if (verificationCode.length !== 6) { setError('Please enter a valid 6-digit code.'); return; }
      if (!validatePassword(newPassword)) { setError('New password must meet the security requirements.'); return; }
      setIsSubmitting(true);
      try {
        await resetPassword({ email, otpCode: verificationCode, newPassword });
        setIsResetSent(true);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to reset password. Please check the code and try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be 8-20 characters long and include at least 3 types: uppercase, lowercase, numbers, or symbols.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/summarizer', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordValid = validatePassword(password);
  const newPasswordValid = validatePassword(newPassword);

  if (isResetSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-zinc-100 bg-white p-10 shadow-xl text-center space-y-5"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Password Reset</h1>
          <p className="text-zinc-500 text-sm">Your password has been successfully reset. You can now sign in with your new password.</p>
          <Button onClick={() => { setIsResetSent(false); setIsForgotPassword(false); setIsVerifyingCode(false); }} className="w-full">
            Back to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 p-4">
      {/* Subtle background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #99f6e4, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #a5f3fc, transparent 70%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-xl sm:p-10"
      >
        {/* Logo */}
        <div className="mb-7 text-center">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            className="p-0.5 relative mx-auto mb-4 h-14 w-14 rounded-2xl overflow-hidden"
          >
            <img src="/app.png" alt="toto.ai logo" className="w-full h-full object-cover" />
          </motion.div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {isForgotPassword ? (isVerifyingCode ? 'Enter Code' : 'Reset Password') : 'Welcome back'}
          </h1>
          {!isForgotPassword && <p className="mt-1 text-sm text-zinc-500">Sign in to continue learning</p>}
          {isForgotPassword && (
            <p className="mt-1 text-sm text-zinc-500">
              {isVerifyingCode ? `Code sent to ${email}` : 'Enter your email to receive a reset code'}
            </p>
          )}
        </div>

        {/* Social buttons — only on normal login */}
        {!isForgotPassword && (
          <>
            <div className="mb-5 flex flex-col gap-3">
              <button
                type="button"
                disabled={!GOOGLE_CLIENT_ID}
                onClick={() => GOOGLE_CLIENT_ID && (window.location.href = buildOAuthUrl('google'))}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <button
                type="button"
                disabled={!GITHUB_CLIENT_ID}
                onClick={() => GITHUB_CLIENT_ID && (window.location.href = buildOAuthUrl('github'))}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GitHubIcon />
                Continue with GitHub
              </button>
            </div>

            <div className="relative mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">or</span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isVerifyingCode && (
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 transition-all"
                placeholder="Email address"
              />
            </div>
          )}

          {isVerifyingCode && (
            <div className="space-y-3">
              <input
                type="text"
                required
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-[1em] text-2xl font-bold rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-zinc-900 placeholder-zinc-300 outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 transition-all"
                placeholder="000000"
              />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={cn(
                    'w-full rounded-xl border py-3 pl-9 pr-11 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all',
                    newPassword && (newPasswordValid
                      ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
                      : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'),
                    !newPassword && 'border-zinc-200 bg-zinc-50 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100'
                  )}
                  placeholder="New password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {!isForgotPassword && (
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    'w-full rounded-xl border py-3 pl-9 pr-24 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all',
                    password && (passwordValid
                      ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
                      : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'),
                    !password && 'border-zinc-200 bg-zinc-50 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100'
                  )}
                  placeholder="Password"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors">
                    Forgot?
                  </button>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
                <Info size={13} className="mt-0.5 shrink-0 text-teal-500" />
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  8-20 characters, at least 3 of: uppercase, lowercase, numbers, symbols.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              <ShieldAlert size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full py-3.5 bg-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Processing…' : isForgotPassword ? (isVerifyingCode ? 'Reset Password' : 'Send Code') : 'Sign In'}
            {!isSubmitting && <ArrowRight size={18} className="ml-2" />}
          </Button>

          {isForgotPassword && (
            <button
              type="button"
              onClick={() => { setIsForgotPassword(false); setIsVerifyingCode(false); setVerificationCode(''); setError(null); }}
              className="w-full text-sm font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Back to Login
            </button>
          )}
        </form>

        {!isForgotPassword && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
              Create one
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M47.532 24.552c0-1.636-.145-3.2-.415-4.695H24.48v9.013h12.971c-.56 2.98-2.24 5.507-4.77 7.198v5.984h7.72c4.516-4.16 7.131-10.29 7.131-17.5z" fill="#4285F4" />
      <path d="M24.48 48c6.51 0 11.97-2.156 15.96-5.848l-7.72-5.984c-2.148 1.44-4.896 2.293-8.24 2.293-6.333 0-11.695-4.277-13.613-10.02H3.052v6.181C7.023 42.874 15.175 48 24.48 48z" fill="#34A853" />
      <path d="M10.867 28.441A14.498 14.498 0 0 1 9.9 24c0-1.54.267-3.035.737-4.441v-6.181H3.052A23.984 23.984 0 0 0 .48 24c0 3.87.93 7.532 2.572 10.622l7.815-6.181z" fill="#FBBC05" />
      <path d="M24.48 9.539c3.567 0 6.768 1.226 9.285 3.636l6.958-6.958C36.437 2.39 30.987 0 24.48 0 15.175 0 7.023 5.126 3.052 13.378l7.815 6.181C12.785 13.816 18.147 9.54 24.48 9.54z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1f2937">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

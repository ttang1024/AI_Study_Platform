import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BrainCircuit, Mail, Lock, User, ArrowRight, ShieldCheck, ShieldAlert, Info, Eye, EyeOff } from 'lucide-react';
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

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, sendOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const validatePassword = (pass: string) => {
    if (pass.length < 8 || pass.length > 20) return false;
    let types = 0;
    if (/[A-Z]/.test(pass)) types++;
    if (/[a-z]/.test(pass)) types++;
    if (/[0-9]/.test(pass)) types++;
    if (/[^A-Za-z0-9]/.test(pass)) types++;
    return types >= 3;
  };

  const handleSendCode = async () => {
    if (!email) { setError('Please enter your email first.'); return; }
    setError(null);
    try {
      await sendOtp(email, 'registration');
      setCountdown(60);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send verification code. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validatePassword(password)) {
      setError('Password must be 8-20 characters long and include at least 3 types: uppercase, lowercase, numbers, or symbols.');
      return;
    }
    if (!verificationCode) { setError('Please enter the verification code.'); return; }
    setIsSubmitting(true);
    try {
      await register({ email, fullName: name, password, otpCode: verificationCode });
      navigate('/summarizer');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordValid = validatePassword(password);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 p-4 py-8">
      {/* Subtle background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #99f6e4, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #a5f3fc, transparent 70%)' }} />
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
          <h1 className="text-2xl font-bold text-zinc-900">Create account</h1>
        </div>

        {/* Social buttons */}
        <div className="mb-5 flex flex-col gap-3">
          <button
            type="button"
            disabled={!GOOGLE_CLIENT_ID}
            onClick={() => GOOGLE_CLIENT_ID && (window.location.href = buildOAuthUrl('google'))}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GoogleIcon />
            Sign up with Google
          </button>
          <button
            type="button"
            disabled={!GITHUB_CLIENT_ID}
            onClick={() => GITHUB_CLIENT_ID && (window.location.href = buildOAuthUrl('github'))}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GitHubIcon />
            Sign up with GitHub
          </button>
        </div>

        <div className="relative mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 transition-all"
              placeholder="Full name"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
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
            <button
              type="button"
              onClick={handleSendCode}
              disabled={countdown > 0}
              className="min-w-[90px] rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {countdown > 0 ? `${countdown}s` : 'Send Code'}
            </button>
          </div>

          <div className="relative">
            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              required
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 transition-all"
              placeholder="6-digit verification code"
            />
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  'w-full rounded-xl border py-3 pl-9 pr-11 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all',
                  password && (passwordValid
                    ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
                    : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'),
                  !password && 'border-zinc-200 bg-zinc-50 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100'
                )}
                placeholder="Password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
              <Info size={13} className="mt-0.5 shrink-0 text-teal-500" />
              <p className="text-[10px] leading-relaxed text-zinc-500">
                8-20 characters, at least 3 of: uppercase, lowercase, numbers, symbols.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              <ShieldAlert size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full py-3.5" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Account…' : 'Create Account'}
            {!isSubmitting && <ArrowRight size={18} className="ml-2" />}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            Sign in
          </Link>
        </p>
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

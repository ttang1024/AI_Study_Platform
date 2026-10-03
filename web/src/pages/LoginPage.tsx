import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldAlert, Info, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { cn } from '../utils/cn';
import { OAuthButtons } from '../components/auth/OAuthButtons';
import { validatePassword } from '@core/utils/validatePassword';


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
      navigate('/library/add', { replace: true });
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
            <img src="/app.png" alt="Toto Study logo" className="w-full h-full object-cover" />
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

        {/* Only on normal login — password reset has no social path. */}
        {!isForgotPassword && <OAuthButtons verb="Continue" />}

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


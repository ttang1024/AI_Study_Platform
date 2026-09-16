import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, ShieldCheck, ShieldAlert, Info, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { cn } from '../utils/cn';
import { OAuthButtons } from '../components/auth/OAuthButtons';
import { validatePassword } from '@core/utils/validatePassword';


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
      navigate('/library/add');
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
            <img src="/app.png" alt="Toto Study logo" className="w-full h-full object-cover" />
          </motion.div>
          <h1 className="text-2xl font-bold text-zinc-900">Create account</h1>
        </div>

        <OAuthButtons verb="Sign up" />

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


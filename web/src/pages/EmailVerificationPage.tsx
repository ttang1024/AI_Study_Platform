import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';

export const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-8 shadow-xl sm:p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Mail size={32} />
        </div>
        
        <h1 className="text-3xl font-bold text-zinc-900">Check your email</h1>
        <p className="mt-2 text-zinc-500">
          We've sent a verification link to your email address. Please click the link to verify your account.
        </p>

        <div className="rounded-2xl bg-zinc-50 p-6 text-left">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" />
            <p className="text-sm text-zinc-600">Verification email sent to alex@example.com</p>
          </div>
        </div>

        <div className="space-y-4">
          <Button onClick={() => navigate('/login')} className="w-full py-4">
            Back to Login
          </Button>
          <button className="text-sm font-medium text-zinc-500 hover:text-primary transition-colors">
            Didn't receive the email? Resend
          </button>
        </div>
      </div>
    </div>
  );
};

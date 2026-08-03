import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, Loader2, ShieldX } from 'lucide-react';
import { certificateService, type PublicCertificate } from '../services/certificateService';

/**
 * The page a shared certificate link opens. Public and unauthenticated by design — someone checking
 * a credential shouldn't need an account to do it.
 *
 * <p>Three outcomes, all of which have to read clearly to a stranger: valid, withdrawn, and no such
 * certificate. "Withdrawn" is deliberately distinct from "not found" — a link that once worked and
 * has since been revoked is a different fact from a link that was never real.</p>
 */
export const VerifyCertificatePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    if (!token) { setState('missing'); return; }
    certificateService
      .verify(token)
      .then(res => { setCertificate(res.data.data); setState('ok'); })
      .catch(() => setState('missing'));
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (state === 'missing' || !certificate) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldX size={48} className="text-text-muted" />
        <h1 className="text-2xl font-bold text-text-main">Certificate not found</h1>
        <p className="max-w-md text-sm text-text-muted">
          This link doesn&apos;t match any certificate. Check that you copied all of it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-10 text-center shadow-sm">
        <Award
          size={56}
          className={certificate.isRevoked ? 'mx-auto text-zinc-400' : 'mx-auto text-amber-500'}
        />

        {certificate.isRevoked && (
          <p className="mt-4 inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
            This certificate was withdrawn by its holder
          </p>
        )}

        <p className="mt-6 text-xs uppercase tracking-widest text-text-muted">
          Certificate of completion
        </p>
        <h1 className="mt-3 text-3xl font-bold text-text-main">{certificate.recipientName}</h1>
        <p className="mt-2 text-sm text-text-muted">has demonstrated mastery of</p>
        <p className="mt-1 text-xl font-bold text-text-main">{certificate.courseName}</p>

        <div className="mt-8 flex items-center justify-center gap-8 border-t border-amber-200 pt-6 text-sm">
          <div>
            <p className="font-bold text-amber-700">{certificate.masteryScore}%</p>
            <p className="text-xs text-text-muted">mastery</p>
          </div>
          <div>
            <p className="font-bold text-text-main">
              {new Date(certificate.issuedAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-text-muted">issued</p>
          </div>
        </div>

        <p className="mt-6 text-xs text-text-muted">Verified by StudyPlatform</p>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Check, Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import {
  certificateService,
  certificateShareUrl,
  type Certificate,
  type CertificateEligibility,
} from '../../services/certificateService';
import { cn } from '../../utils/cn';

export const CertificatesPanel: React.FC = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [eligibility, setEligibility] = useState<CertificateEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, elig] = await Promise.all([
        certificateService.getMine(),
        certificateService.getEligibility(),
      ]);
      setCertificates(mine.data.data);
      setEligibility(elig.data.data);
    } catch {
      setError('Could not load your certificates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const issue = async (courseId: string) => {
    setBusyId(courseId); setError(null);
    try {
      await certificateService.issue(courseId);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not issue that certificate.');
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (id: string) => {
    setBusyId(id); setError(null);
    try {
      await certificateService.revoke(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not revoke that certificate.');
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (certificate: Certificate) => {
    await navigator.clipboard.writeText(
      certificateShareUrl(window.location.origin, certificate.publicToken),
    );
    setCopiedId(certificate.courseCertificateId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  // Issued courses are filtered out of the progress list: a course you already hold a certificate
  // for has nothing left to work toward here, and showing it at 100% twice is just noise.
  const inProgress = eligibility.filter(e => !e.alreadyIssued);

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-text-main">Your certificates</h3>
        {certificates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border-color)] p-8 text-center text-sm text-text-muted">
            Reach 80% mastery on a course to earn your first certificate.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {certificates.map(certificate => (
              <li
                key={certificate.courseCertificateId}
                className={cn(
                  'rounded-2xl border p-5',
                  certificate.revokedAt
                    ? 'border-[var(--border-color)] opacity-60'
                    : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <Award
                    size={28}
                    className={certificate.revokedAt ? 'text-text-muted' : 'text-amber-500'}
                  />
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-amber-700">
                    {certificate.masteryScore}%
                  </span>
                </div>
                <p className="mt-3 font-bold text-text-main">{certificate.courseName}</p>
                <p className="text-xs text-text-muted">
                  {certificate.recipientName} ·{' '}
                  {new Date(certificate.issuedAt).toLocaleDateString()}
                  {certificate.revokedAt && ' · withdrawn'}
                </p>

                {!certificate.revokedAt && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => copyLink(certificate)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-text-main shadow-sm"
                    >
                      {copiedId === certificate.courseCertificateId
                        ? <Check size={12} />
                        : <Copy size={12} />}
                      {copiedId === certificate.courseCertificateId ? 'Copied' : 'Copy link'}
                    </button>
                    <a
                      href={`/verify/${certificate.publicToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-text-main shadow-sm"
                    >
                      <ExternalLink size={12} /> View
                    </a>
                    <button
                      onClick={() => revoke(certificate.courseCertificateId)}
                      disabled={busyId === certificate.courseCertificateId}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Withdraw
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {inProgress.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-text-main">Progress toward the next one</h3>
          <ul className="space-y-2">
            {inProgress.map(course => (
              <li
                key={course.courseId}
                className="flex items-center gap-4 rounded-xl border border-[var(--border-color)] p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-main">{course.courseName}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-main)]">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        course.isEligible ? 'bg-amber-500' : 'bg-[var(--primary)]',
                      )}
                      style={{
                        width: `${Math.min(100, (course.masteryScore / course.requiredScore) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {course.masteryScore}% of {course.requiredScore}% needed
                  </p>
                </div>
                <button
                  onClick={() => issue(course.courseId)}
                  disabled={!course.isEligible || busyId === course.courseId}
                  className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {busyId === course.courseId
                    ? <Loader2 size={14} className="animate-spin" />
                    : 'Claim'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

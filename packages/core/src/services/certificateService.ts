import type { HttpClient } from '../http';

export interface Certificate {
  courseCertificateId: string;
  courseId: string | null;
  courseName: string;
  recipientName: string;
  masteryScore: number;
  publicToken: string;
  issuedAt: string;
  revokedAt: string | null;
}

/** What an anonymous verifier sees — deliberately narrower than {@link Certificate}. */
export interface PublicCertificate {
  courseName: string;
  recipientName: string;
  masteryScore: number;
  issuedAt: string;
  isRevoked: boolean;
}

export interface CertificateEligibility {
  courseId: string;
  courseName: string;
  masteryScore: number;
  requiredScore: number;
  isEligible: boolean;
  alreadyIssued: boolean;
}

export function createCertificateService(http: HttpClient) {
  return {
    getMine: () => http.get<{ data: Certificate[] }>('/api/certificates'),

    /** Where each course stands against the threshold — drives the "almost there" nudge. */
    getEligibility: () =>
      http.get<{ data: CertificateEligibility[] }>('/api/certificates/eligibility'),

    issue: (courseId: string) =>
      http.post<{ data: Certificate; message: string }>(`/api/certificates/courses/${courseId}`),

    revoke: (id: string) =>
      http.delete<{ success: boolean; message: string }>(`/api/certificates/${id}`),

    /** Anonymous. Used by the public verification page, which has no session. */
    verify: (token: string) => http.get<{ data: PublicCertificate }>(`/api/verify/${token}`),
  };
}

/** Builds the shareable verification URL for a certificate. */
export function certificateShareUrl(origin: string, publicToken: string): string {
  return `${origin.replace(/\/$/, '')}/verify/${publicToken}`;
}

import type { HttpClient } from '../http';

export type PlanKey = 'free' | 'pro' | 'team';

export interface Plan {
  key: PlanKey;
  displayName: string;
  monthlyPriceUsd: number;
  /** 0 means unlimited. */
  dailyTokenLimit: number;
  includesHostedKeys: boolean;
  /** 0 means unlimited. */
  maxClassrooms: number;
  maxStudentsPerClassroom: number;
}

export interface MyPlan {
  plan: Plan;
  /** 'user' | 'organization' | 'default' — where the entitlement came from. */
  source: string;
  expiresAt?: string;
  status: string;
  /** False on self-hosted installs with no payment processor configured. */
  billingEnabled: boolean;
  /** True only for a personal subscription; org-inherited plans are managed by the org. */
  canManageBilling: boolean;
  tokensUsedToday: number;
  /** 0 means unlimited. */
  dailyTokenLimit: number;
}

export interface CheckoutSession {
  url: string;
  externalSessionId: string;
}

export function createBillingService(http: HttpClient) {
  return {
    getPlans: () => http.get<{ data: Plan[] }>('/api/billing/plans'),

    getMyPlan: () => http.get<{ data: MyPlan }>('/api/billing/me'),

    startCheckout: (planKey: PlanKey, successUrl: string, cancelUrl: string) =>
      http.post<{ data: CheckoutSession }>('/api/billing/checkout', { planKey, successUrl, cancelUrl }),

    openPortal: (returnUrl: string) =>
      http.post<{ data: string }>(`/api/billing/portal?returnUrl=${encodeURIComponent(returnUrl)}`),
  };
}

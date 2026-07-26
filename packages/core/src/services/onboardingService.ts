import type { HttpClient } from '../http';

export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
  actionPath?: string;
}

export interface OnboardingState {
  dismissed: boolean;
  complete: boolean;
  hasDemoContent: boolean;
  completedCount: number;
  totalCount: number;
  steps: OnboardingStep[];
}

export function createOnboardingService(http: HttpClient) {
  return {
    getState: () => http.get<{ data: OnboardingState }>('/api/onboarding'),

    dismiss: () => http.post<{ data: boolean }>('/api/onboarding/dismiss'),

    /** Seeds a sample course. Makes no AI call, so it works with no provider key configured. */
    seedDemo: () => http.post<{ data: string }>('/api/onboarding/demo'),
  };
}

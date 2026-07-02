import React from 'react';
import { PracticeSection } from '../components/practice/PracticeSection';

/**
 * Top-level home for practice tests and smart sessions. Previously a tab on the
 * Insights page — /insights?tab=practice still redirects here for old links.
 */
export const PracticePage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
        Practice <span className="text-[var(--primary)]">Center</span>
      </h1>
    </div>
    <PracticeSection />
  </div>
);

import React, { useState } from 'react';
import { PracticeSection } from '../components/practice/PracticeSection';
import CodeCell from '../components/practice/CodeCell';

const STARTER_CODE = `# A worked example. Edit it and press Run.
def fizzbuzz(n):
    if n % 15 == 0:
        return "FizzBuzz"
    if n % 3 == 0:
        return "Fizz"
    if n % 5 == 0:
        return "Buzz"
    return str(n)


for i in range(1, 16):
    print(fizzbuzz(i))
`;

const STARTER_TESTS = `assert fizzbuzz(3) == "Fizz"
assert fizzbuzz(5) == "Buzz"
assert fizzbuzz(15) == "FizzBuzz"
assert fizzbuzz(7) == "7"
print("checks passed")
`;

/**
 * Top-level home for practice tests and smart sessions. Previously a tab on the
 * Insights page — /insights?tab=practice still redirects here for old links.
 */
export const PracticePage: React.FC = () => {
  const [tab, setTab] = useState<'practice' | 'code'>('practice');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
          Practice <span className="text-[var(--primary)]">Center</span>
        </h1>
      </div>

      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {(['practice', 'code'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-[var(--primary)] text-[var(--primary)] font-medium'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {t === 'practice' ? 'Tests & sessions' : 'Code'}
          </button>
        ))}
      </div>

      {tab === 'practice' && <PracticeSection />}

      {tab === 'code' && (
        <div className="space-y-3 max-w-3xl">
          <p className="text-sm text-text-muted">
            Python runs entirely in your browser — nothing you write here is sent anywhere. The first
            run downloads the interpreter, so it takes a few seconds; later runs are instant.
          </p>
          <CodeCell prompt="Make all four checks pass." initialCode={STARTER_CODE} tests={STARTER_TESTS} />
        </div>
      )}
    </div>
  );
};

export default PracticePage;

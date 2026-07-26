import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, Loader2, Sparkles, X } from 'lucide-react';
import onboardingService, { type OnboardingState } from '../../services/onboardingService';

/**
 * Getting-started checklist for a new account.
 *
 * Renders nothing once dismissed or complete — a checklist that lingers after you have finished it
 * is just clutter. Step completion comes from the server, which derives it from the user's actual
 * library, so ticks cannot survive deleting the thing that earned them.
 */
export const OnboardingChecklist: React.FC = () => {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await onboardingService.getState();
      setState(res.data?.data ?? null);
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state || state.dismissed || state.complete) return null;

  const dismiss = async () => {
    setState(null); // Optimistic: the panel should vanish on click, not after a round trip.
    try {
      await onboardingService.dismiss();
    } catch {
      void load();
    }
  };

  const addSample = async () => {
    setBusy(true);
    setError('');
    try {
      await onboardingService.seedDemo();
      await load();
    } catch {
      setError('Could not add the sample course.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-main">Get started</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {state.completedCount} of {state.totalCount} done
          </p>
        </div>
        <button onClick={() => void dismiss()} className="text-text-muted hover:text-text-main" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-surface-hover overflow-hidden">
        <div
          className="h-full bg-teal-500 transition-all"
          style={{ width: `${(state.completedCount / state.totalCount) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {state.steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2.5">
            {step.done ? (
              <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              {step.done || !step.actionPath ? (
                <span className={`text-sm ${step.done ? 'text-text-muted line-through' : 'text-text-main'}`}>
                  {step.title}
                </span>
              ) : (
                <Link to={step.actionPath} className="text-sm text-text-main hover:text-teal-600">
                  {step.title}
                </Link>
              )}
              {!step.done && <p className="text-xs text-text-muted mt-0.5">{step.description}</p>}
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      {/* Offered only until they have their own material: the sample is a way to see the product
          working before configuring an AI key, not something to add to a real library. */}
      {!state.hasDemoContent && (
        <button
          onClick={() => void addSample()}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Add a sample course to look around first
        </button>
      )}
    </section>
  );
};

export default OnboardingChecklist;

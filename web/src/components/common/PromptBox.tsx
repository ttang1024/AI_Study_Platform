import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

type PromptVariant = 'error' | 'info';

interface Prompt {
  id: number;
  message: string;
  variant: PromptVariant;
}

interface PromptContextValue {
  showPrompt: (message: string, variant?: PromptVariant) => void;
}

const PromptContext = createContext<PromptContextValue | null>(null);

const promptStyles: Record<PromptVariant, string> = {
  error: 'border-red-200 text-red-700 shadow-red-950/10',
  info: 'border-zinc-200 text-zinc-700 shadow-zinc-950/10',
};

const iconStyles: Record<PromptVariant, string> = {
  error: 'text-red-500',
  info: 'text-zinc-500',
};

export const PromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const showPrompt = useCallback((message: string, variant: PromptVariant = 'error') => {
    setPrompt({ id: Date.now(), message, variant });
  }, []);

  useEffect(() => {
    if (!prompt) return;
    const timeout = window.setTimeout(() => setPrompt(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [prompt]);

  const value = useMemo(() => ({ showPrompt }), [showPrompt]);

  return (
    <PromptContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4" aria-live="assertive">
        <AnimatePresence mode="wait">
          {prompt && (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-xl ${promptStyles[prompt.variant]}`}
            >
              <AlertCircle size={18} className={`mt-0.5 shrink-0 ${iconStyles[prompt.variant]}`} />
              <p className="min-w-0 flex-1 font-medium leading-5">{prompt.message}</p>
              <button
                type="button"
                onClick={() => setPrompt(null)}
                className="shrink-0 rounded-full p-1 text-red-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                aria-label="Dismiss prompt"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PromptContext.Provider>
  );
};

export function usePrompt() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error('usePrompt must be used within PromptProvider');
  }
  return context;
}

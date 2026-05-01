import React, { useState, useEffect } from 'react';
import { KeyRound, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { aiSettingsService } from '../../services/aiSettingsService';

export const AIProviderBanner: React.FC = () => {
  const [missingKey, setMissingKey] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const check = () => {
      const key = aiSettingsService.getActiveKey();
      setMissingKey(!key);
    };
    check();
    // Re-check when localStorage changes (e.g. user saves settings in another tab)
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  if (!missingKey || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-amber-500"
      >
        <KeyRound size={15} />
        <span>No AI provider API key configured — AI features won't work.</span>
        <button
          onClick={() => navigate('/settings', { state: { activeTab: 'ai' } })}
          className="underline underline-offset-2 hover:opacity-80 transition-opacity ml-1"
        >
          Go to Settings
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 hover:opacity-80 transition-opacity"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

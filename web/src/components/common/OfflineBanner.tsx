import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      setTimeout(() => setShowBackOnline(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showBackOnline) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white ${
          isOnline ? 'bg-emerald-500' : 'bg-zinc-800'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi size={15} />
            Back online — all features restored
          </>
        ) : (
          <>
            <WifiOff size={15} />
            You're offline — some features may be limited
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

import React from 'react';
import { motion } from 'motion/react';

export const LOGO_STYLES = `
  @keyframes logoGlow {
    0%, 100% { box-shadow: 0 4px 18px rgba(13,148,136,0.4); }
    50%       { box-shadow: 0 4px 28px rgba(20,184,166,0.55), 0 0 36px rgba(8,145,178,0.2); }
  }
`;

export const Logo: React.FC<{ sm?: boolean }> = ({ sm }) => (
  <div className="flex items-center gap-2.5">
    <motion.div
      whileHover={{ scale: 1.1, rotate: 6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 16 }}
      className={`relative ${sm ? 'w-6 h-6' : 'w-9 h-9'} rounded-xl overflow-hidden`}
      style={{ animation: 'logoGlow 3s ease-in-out infinite' }}
    >
      <img src="/app.png" alt="toto.ai logo" className="w-full h-full object-cover" />
    </motion.div>
    <span
      className={`${sm ? 'text-sm' : 'text-lg'} font-extrabold tracking-tight`}
      style={{ fontFamily: 'Orbitron, sans-serif' }}
    >
      toto<span style={{ color: '#22d3ee' }}>.ai</span>
    </span>
  </div>
);

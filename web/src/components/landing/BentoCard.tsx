import React from 'react';
import { motion } from 'motion/react';
import { Globe } from 'lucide-react';

interface BentoCardProps {
  icon: React.ElementType;
  title: string;
  desc: string;
  gradient: string;
  glow: string;
  big?: boolean;
  wide?: boolean;
  isNew?: boolean;
}

export const BentoCard: React.FC<BentoCardProps> = ({ icon: Icon, title, desc, gradient, glow, big, wide, isNew }) => (
  <motion.div
    whileHover={{ y: -4, scale: 1.01 }}
    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    className={`relative p-6 rounded-2xl h-full cursor-default ${(big || wide) ? 'flex gap-6 items-start' : 'flex flex-col'}`}
    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 36px ${glow}`;
      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
    }}
  >
    <div
      className={`flex-shrink-0 ${(big || wide) ? 'w-14 h-14' : 'w-11 h-11'} rounded-xl flex items-center justify-center ${(big || wide) ? 'mb-0' : 'mb-4'} bg-gradient-to-br ${gradient}`}
      style={{ boxShadow: `0 6px 22px ${glow}` }}
    >
      <Icon className={`${(big || wide) ? 'w-6 h-6' : 'w-5 h-5'} text-white`} />
    </div>
    <div className={wide ? 'flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' : ''}>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className={`${(big || wide) ? 'text-lg' : 'text-base'} font-bold text-white`}>{title}</h3>
          {isNew && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(240,171,252,0.15)', color: '#f0abfc', border: '1px solid rgba(240,171,252,0.3)' }}
            >
              NEW
            </span>
          )}
        </div>
        <p className={`text-sm text-white/40 leading-relaxed ${wide ? 'max-w-xl' : ''}`}>{desc}</p>
      </div>
      {wide && (
        <div
          className="flex items-center gap-2 shrink-0 text-xs font-semibold px-4 py-2 rounded-xl"
          style={{ background: `${glow.replace('0.35', '0.15')}`, border: `1px solid ${glow.replace('0.35', '0.3')}`, color: '#c4b5fd' }}
        >
          <Globe className="w-3.5 h-3.5" />
          No account needed
        </div>
      )}
    </div>
  </motion.div>
);

import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface BentoCardShellProps {
  background: string;
  border: string;
  hoverShadow: string;
  hoverBorder: string;
  hoverScale?: number;
  rootRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}

export const BentoCardShell: React.FC<BentoCardShellProps> = ({
  background, border, hoverShadow, hoverBorder, hoverScale = 1.015, rootRef, children,
}) => (
  <motion.div
    ref={rootRef}
    whileHover={{ y: -5, scale: hoverScale }}
    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    className="relative flex flex-col p-6 rounded-2xl h-full cursor-default"
    style={{ background, border: `1px solid ${border}` }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = hoverShadow;
      e.currentTarget.style.borderColor = hoverBorder;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = border;
    }}
  >
    {children}
  </motion.div>
);

interface BentoCardHeaderProps {
  icon: LucideIcon;
  title: React.ReactNode;
  gradient: string;
  iconGlow: string;
  isNew?: boolean;
  right?: React.ReactNode;
}

export const BentoCardHeader: React.FC<BentoCardHeaderProps> = ({
  icon: Icon, title, gradient, iconGlow, isNew, right,
}) => (
  <div className={`flex items-center ${right ? 'justify-between ' : ''}mb-4`}>
    <div className="flex items-center gap-3">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${gradient}`}
        style={{ boxShadow: iconGlow }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-white">{title}</h3>
        {isNew && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(240,171,252,0.15)', color: '#f0abfc', border: '1px solid rgba(240,171,252,0.3)' }}>NEW</span>
        )}
      </div>
    </div>
    {right}
  </div>
);

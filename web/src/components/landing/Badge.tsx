import React from 'react';

interface BadgeProps {
  icon: React.ElementType;
  label: string;
  color?: string;
}

export const Badge: React.FC<BadgeProps> = ({ icon: Icon, label, color = '#67e8f9' }) => (
  <div
    className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest"
    style={{
      background: `${color}18`,
      border: `1px solid ${color}45`,
      color,
    }}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </div>
);

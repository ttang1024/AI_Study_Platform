import React from 'react';
import { motion } from 'motion/react';
import { Link as RouterLink } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface DuplicateAlertProps {
  label: string;
  /** Omitted when the existing item's course can't be resolved — the alert still shows. */
  courseName?: string;
  to: string;
}

export const DuplicateAlert: React.FC<DuplicateAlertProps> = ({ label, courseName, to }) => (
  <motion.div
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.15 }}
    className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3"
  >
    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-amber-800">This {label} already exists</p>
      <p className="text-xs text-amber-600 mt-0.5">
        {courseName
          ? <>Found in course: <span className="font-semibold">{courseName}</span></>
          : 'Already in your library'}
      </p>
    </div>
    <RouterLink
      to={to}
      className="shrink-0 flex items-center gap-1 text-xs font-black text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
    >
      View <ArrowRight size={12} />
    </RouterLink>
  </motion.div>
);

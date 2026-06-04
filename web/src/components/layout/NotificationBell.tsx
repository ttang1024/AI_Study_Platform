import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, X, CalendarClock, Flame, Target, Lightbulb, ListChecks, Check,
} from 'lucide-react';
import { notificationService, type AppNotification, type NotificationType } from '../../services/notificationService';
import { cn } from '../../utils/cn';

const TYPE_ICON: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  due:    { icon: CalendarClock, color: '#0d9488' },
  streak: { icon: Flame,         color: '#f97316' },
  goal:   { icon: Target,        color: '#2563eb' },
  gap:    { icon: Lightbulb,     color: '#dc2626' },
  review: { icon: ListChecks,    color: '#7c3aed' },
};

const SEEN_KEY = 'notif-seen';
const DISMISSED_KEY = 'notif-dismissed';

const loadSet = (key: string): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]); }
  catch { return new Set(); }
};
const saveSet = (key: string, set: Set<string>) => {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* ignore */ }
};

interface Props { className?: string }

export const NotificationBell: React.FC<Props> = ({ className }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => loadSet(SEEN_KEY));
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadSet(DISMISSED_KEY));
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const refresh = () => {
    notificationService.getNotifications()
      .then(r => setItems(r.items))
      .catch(() => { /* silently ignore — non-critical */ });
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5 * 60 * 1000); // poll every 5 min while the app is open
    return () => clearInterval(t);
  }, []);

  const visible = items.filter(i => !dismissed.has(i.id));
  const unread = visible.filter(i => !seen.has(i.id)).length;

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      // Mark everything currently visible as seen.
      const next = new Set(seen);
      visible.forEach(i => next.add(i.id));
      setSeen(next); saveSet(SEEN_KEY, next);
    }
    setOpen(v => !v);
  };

  const dismiss = (id: string) => {
    const next = new Set(dismissed); next.add(id);
    setDismissed(next); saveSet(DISMISSED_KEY, next);
  };

  const go = (n: AppNotification) => {
    dismiss(n.id);
    setOpen(false);
    if (n.url) navigate(n.url);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={cn('relative rounded-lg p-2 text-text-muted hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors', className)}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {ReactDOM.createPortal(
        <AnimatePresence>
          {open && anchor && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="fixed z-[9999] w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl overflow-hidden"
                style={{ top: anchor.top, right: anchor.right }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                  <p className="text-sm font-bold text-text-main">Reminders</p>
                  <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-main"><X size={16} /></button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto">
                  {visible.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <Check size={26} className="mx-auto text-[var(--primary)] mb-2" />
                      <p className="text-sm font-semibold text-text-main">You’re all caught up</p>
                      <p className="text-[12px] text-text-muted mt-1">No reviews due right now.</p>
                    </div>
                  ) : visible.map(n => {
                    const meta = TYPE_ICON[n.type] ?? TYPE_ICON.review;
                    const Icon = meta.icon;
                    return (
                      <div key={n.id} className="group flex items-start gap-3 px-4 py-3 border-b border-[var(--border-color)] last:border-0 hover:bg-black/[0.02]">
                        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: `${meta.color}14` }}>
                          <Icon size={15} style={{ color: meta.color }} />
                        </div>
                        <button onClick={() => go(n)} className="flex-1 min-w-0 text-left">
                          <p className="text-[13px] font-semibold text-text-main leading-snug">{n.title}</p>
                          <p className="text-[12px] text-text-muted leading-snug mt-0.5">{n.body}</p>
                        </button>
                        <button
                          onClick={() => dismiss(n.id)}
                          className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-main transition-opacity mt-0.5"
                          aria-label="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};

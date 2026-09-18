import React from 'react';
import { Check, Copy, Github, Globe } from 'lucide-react';
import { cn } from '../../utils/cn';

export const GITHUB_REPO_URL = 'https://github.com/ttang1024/AI_Study_Platform';

/** Public site the share belongs to. Shares are opened by people who have never seen the app,
 *  so the bar has to say where they are and where the code lives without a login. */
const siteOrigin = typeof window === 'undefined' ? '' : window.location.origin;
const siteHost = typeof window === 'undefined' ? 'toto-study.com' : window.location.host;

const linkClass =
  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-muted ' +
  'transition-colors hover:bg-primary/10 hover:text-primary';

interface ShareTopBarProps {
  copied: boolean;
  onCopy: () => void;
}

export const ShareTopBar: React.FC<ShareTopBarProps> = ({ copied, onCopy }) => (
  <header className="sticky top-0 z-40 border-b border-[var(--border-color)]/70 bg-[var(--bg-sidebar)]/85 backdrop-blur-xl">
    <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
      <a href="/" className="flex items-center gap-2.5 min-w-0">
        <img
          src="/app.png"
          alt=""
          className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
        />
        <span
          className="truncate text-[15px] font-extrabold tracking-tight text-text-main"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          Toto <span className="text-primary">Study</span>
        </span>
      </a>

      <nav className="flex items-center gap-0.5 sm:gap-1">
        {/* Where this page lives, and where its source lives — icons carry it on phones. */}
        <a href={siteOrigin || '/'} className={linkClass} title={`Open ${siteHost}`}>
          <Globe size={14} />
          <span className="hidden sm:inline">{siteHost}</span>
        </a>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="View the source on GitHub"
        >
          <Github size={14} />
          <span className="hidden sm:inline">GitHub</span>
        </a>
        <button
          onClick={onCopy}
          title="Copy the link to this page"
          className={cn(
            linkClass,
            'border',
            copied
              ? 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-600'
              : 'border-[var(--border-color)]',
          )}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy link'}</span>
        </button>
      </nav>
    </div>
  </header>
);

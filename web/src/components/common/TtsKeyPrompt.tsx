import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { KeyRound, X, ExternalLink, Check, MonitorSpeaker } from 'lucide-react';
import { ttsSettingsService } from '../../services/ttsSettingsService';

interface TtsKeyPromptProps {
  onSaved: () => void;
  onDismiss: () => void;
  onUseBrowser?: () => void;
}

export const TtsKeyPrompt: React.FC<TtsKeyPromptProps> = ({ onSaved, onDismiss, onUseBrowser }) => {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

  const handleSave = () => {
    if (!key.trim()) return;
    const settings = ttsSettingsService.load();
    ttsSettingsService.save({ ...settings, humeApiKey: key.trim() });
    setSaved(true);
    setTimeout(() => onSaved(), 600);
  };

  return ReactDOM.createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(480px,calc(100vw-2rem))]">
      <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl shadow-2xl px-5 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">Hume AI key required</p>
              <p className="text-xs text-text-muted">Enter your API key to enable high-quality TTS.</p>
            </div>
          </div>
          <button onClick={onDismiss} className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-zinc-100 transition-all shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            placeholder="hume_…"
            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm outline-none focus:border-primary font-mono"
          />
          <button
            onClick={handleSave}
            disabled={!key.trim() || saved}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {saved ? <Check size={14} /> : null}
            {saved ? 'Saved!' : 'Save & Play'}
          </button>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-3">
          <a
            href="https://platform.hume.ai/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
          >
            Get your API key at platform.hume.ai <ExternalLink size={11} />
          </a>
          {onUseBrowser && (
            <button
              onClick={onUseBrowser}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-main transition-colors shrink-0"
            >
              <MonitorSpeaker size={13} />
              Use browser voice
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

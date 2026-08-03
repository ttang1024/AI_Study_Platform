import React from 'react';
import { motion } from 'motion/react';
import { Key, ExternalLink, Unlock } from 'lucide-react';
import { FadeIn } from './LandingAnimations';
import { Badge } from './Badge';
import { TerminalCard } from './TerminalCard';
import { PROVIDER_ICON_SRC } from '../settings/ProviderIcon';

const PROVIDERS = [
  { name: 'Google Gemini', id: 'gemini', color: '#22d3ee', keyHint: 'AIza...', url: 'aistudio.google.com', model: 'gemini-2.0-flash' },
  { name: 'OpenAI', id: 'openai', color: '#4ade80', keyHint: 'sk-...', url: 'platform.openai.com', model: 'gpt-4o-mini' },
  { name: 'Claude', id: 'claude', color: '#fb923c', keyHint: 'sk-ant-...', url: 'console.anthropic.com', model: 'claude-haiku' },
  { name: 'Grok', id: 'grok', color: '#facc15', keyHint: 'xai-...', url: 'console.x.ai', model: 'grok-3-mini' },
  { name: 'DeepSeek', id: 'deepseek', color: '#60a5fa', keyHint: 'sk-...', url: 'platform.deepseek.com', model: 'deepseek-chat' },
  { name: 'Kimi', id: 'kimi', color: '#a78bfa', keyHint: 'sk-...', url: 'platform.moonshot.cn', model: 'moonshot-v1-8k' },
  { name: 'Doubao', id: 'doubao', color: '#f87171', keyHint: 'custom', url: 'ark.volcengine.com', model: 'doubao-pro' },
  { name: 'Qwen', id: 'qwen', color: '#34d399', keyHint: 'sk-...', url: 'dashscope.aliyuncs.com', model: 'qwen-plus' },
  { name: 'Wenxin Yiyan', id: 'wenxin', color: '#38bdf8', keyHint: 'bce-v3/...', url: 'console.bce.baidu.com/qianfan', model: 'ernie-4.0-8k' },
];

export const ProvidersSection: React.FC = () => (
  <section className="relative py-24 px-6">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24"
      style={{ background: 'linear-gradient(to bottom, transparent, rgba(74,222,128,0.4), transparent)' }} />

    <FadeIn className="max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <Badge icon={Unlock} label="100% Free & Open Source" color="#4ade80" />
        <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight mt-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <span style={{ background: 'linear-gradient(135deg, #4ade80, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Your AI,</span>{' '}
          <span style={{ background: 'linear-gradient(135deg, #22d3ee, #14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Your Deployment</span>
        </h2>
        <p className="mt-4 text-white/40 max-w-lg mx-auto text-sm leading-relaxed">
          Run it locally, start with Docker, or deploy to AWS with ECS on EC2, S3, and RDS.
          Bring your own API key — no subscriptions, no vendor lock-in, no limits.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 items-start">
        <TerminalCard />

        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Key className="w-4 h-4 text-cyan-400 shrink-0" />
            <p className="text-sm text-white/50">
              Get a free API key from any provider below, then paste it in{' '}
              <span className="text-cyan-400 font-semibold">Settings → AI Services</span>.
              Switch providers anytime — no lock-in.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PROVIDERS.map((p, i) => (
              <FadeIn key={p.id} delay={i * 0.06}>
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="relative flex flex-col gap-2 p-4 rounded-xl cursor-default"
                  style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${p.color}22`, borderLeft: `3px solid ${p.color}` }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 24px ${p.color}20`;
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.045)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)';
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      {PROVIDER_ICON_SRC[p.id] && (
                        <img
                          src={PROVIDER_ICON_SRC[p.id]}
                          alt=""
                          className="h-5 w-5 shrink-0 object-contain"
                        />
                      )}
                      <span className="truncate text-sm font-bold" style={{ color: p.color }}>{p.name}</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs rounded px-2 py-1" style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.35)' }}>
                    {p.keyHint}
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-white/25 truncate">{p.model}</span>
                    <a href={`https://${p.url}`} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-0.5 text-[10px] font-semibold transition-colors hover:opacity-80"
                      style={{ color: p.color }}>
                      Get key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>

          <p className="text-xs text-white text-center">
            Your API key is stored locally and sent directly to the provider — we never see it.
          </p>
        </div>
      </div>
    </FadeIn>
  </section>
);

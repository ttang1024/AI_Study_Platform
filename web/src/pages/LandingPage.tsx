import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BrainCircuit as _BrainCircuit, BookOpen, Sparkles, Map,
  Trophy, ArrowRight,
  Zap, ChevronRight, GraduationCap, Bot,
  Share2,
  Search,
  Globe,
  Award as _Award,
  Github, Key, ExternalLink, Unlock,
  Network, Highlighter,
} from 'lucide-react';
import { useOptionalAuth } from '../context/AuthContext';
import { getPublicEnv } from '../utils/env';
import { Typewriter, Counter, Particles, FadeIn } from '../components/landing/LandingAnimations';
import { Logo, LOGO_STYLES } from '../components/landing/Logo';
import { Badge } from '../components/landing/Badge';
import { TerminalCard } from '../components/landing/TerminalCard';
import { BentoCard } from '../components/landing/BentoCard';
import {
  BentoFlashcardCard,
  BentoNoteCard,
  BentoPlayCard,
  BentoGlossaryCard,
  BentoProblemCard,
  BentoStudyGroupCard,
} from '../components/landing/BentoCards';

const GOOGLE_CLIENT_ID = getPublicEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID') ?? getPublicEnv('VITE_GOOGLE_CLIENT_ID');
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: 'signin' | 'signup' | 'use';
            itp_support?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: () => void;
          cancel?: () => void;
        };
      };
    };
  }
}

const PROVIDER_ICON_SRC: Record<string, string> = {
  gemini: '/images/gemini.png',
  openai: '/images/openai.svg',
  claude: '/images/claude.ico',
  deepseek: '/images/deepseek.png',
  grok: '/images/grok.ico',
  kimi: '/images/moonshot.ico',
  doubao: '/images/doubao.png',
  qwen: '/images/qwen.png',
  wenxin: '/images/yiyan.ico',
};

export const LandingPage: React.FC = () => {
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const isAuthLoading = auth?.isLoading ?? false;
  const username = auth?.user?.name || auth?.user?.email || 'Open app';
  const go = () => window.location.assign(isAuthenticated ? '/summarizer' : '/login');
  const [googleError, setGoogleError] = useState<string | null>(null);
  const oneTapInitialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      window.google?.accounts.id.cancel?.();
      return;
    }

    if (isAuthLoading || !GOOGLE_CLIENT_ID || !auth?.loginWithGoogleCredential) return;

    let shouldPrompt = true;

    const initializeGoogleSignIn = () => {
      if (!shouldPrompt || !window.google || oneTapInitialized.current || auth.isAuthenticated) return;
      oneTapInitialized.current = true;

      const handleCredential = ({ credential }: { credential?: string }) => {
        if (!credential) return;
        auth.loginWithGoogleCredential(credential)
          .then(() => window.location.assign('/summarizer'))
          .catch(() => setGoogleError('Google sign-in failed. Please try again.'));
      };

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
        use_fedcm_for_prompt: true,
      });

      window.google.accounts.id.prompt();
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      if (window.google) initializeGoogleSignIn();
      else existingScript.addEventListener('load', initializeGoogleSignIn, { once: true });
      return () => {
        shouldPrompt = false;
        existingScript.removeEventListener('load', initializeGoogleSignIn);
      };
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    script.onerror = () => setGoogleError('Google sign-in is unavailable right now.');
    document.head.appendChild(script);
    return () => {
      shouldPrompt = false;
    };
  }, [auth, isAuthenticated, isAuthLoading]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white"
      style={{ background: 'linear-gradient(160deg, #020810 0%, #040c18 50%, #020810 100%)' }}>
      <style>{LOGO_STYLES}</style>

      {/* dot grid */}
      <div className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />

      <Particles />

      {/* orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute w-[900px] h-[900px] -top-72 -left-60 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0891b2, transparent 65%)', filter: 'blur(80px)' }} />
        <div className="absolute w-[600px] h-[600px] top-32 right-0 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #059669, transparent 65%)', filter: 'blur(80px)' }} />
        <div className="absolute w-[500px] h-[500px] bottom-40 left-1/4 rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #ec4899, transparent 65%)', filter: 'blur(80px)' }} />
      </div>

      {/* ══════════════════ NAVBAR ══════════════════════════════════════ */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(2,8,16,0.8)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(6,182,212,0.08)',
        }}
      >
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
            Open Source
          </span>
        </div>
        <div className="flex items-center gap-3">
          <motion.a href="https://github.com/ttang1024/AI_Study_Platform" target="_blank" rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
            title="Self-host with your own API keys">
            <Github className="w-3.5 h-3.5" />
            <span className="hidden md:inline">GitHub</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </motion.a>
          <button onClick={go}
            className="hidden sm:block text-sm font-medium text-white/50 hover:text-white transition-colors px-3 py-1.5">
            {isAuthenticated ? username : 'Sign in'}
          </button>
          <motion.button onClick={go} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="text-sm font-bold px-5 py-2 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #059669, #0891b2)',
              boxShadow: '0 0 24px rgba(6,182,212,0.4)',
            }}>
            {isAuthenticated ? 'Open App' : 'Get Started Free'}
          </motion.button>
        </div>
      </motion.nav>

      {/* ══════════════════ HERO ════════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-28 pb-20">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Badge icon={Zap} label="Powered by AI" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.28 }} className="mb-4">
          <span className="text-2xl sm:text-3xl font-extrabold"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              background: 'linear-gradient(135deg, #a5f3fc, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 18px rgba(34,211,238,0.5))',
            }}>
            toto.ai
          </span>
          <span className="ml-3 text-sm sm:text-base text-white/30 font-medium tracking-wide">easy study platform</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-none tracking-tight mb-6"
          style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <span style={{
            background: 'linear-gradient(135deg, #e0f7ff 0%, #a5f3fc 50%, #c7d2fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 24px rgba(34,211,238,0.3))',
          }}>
            Learn
          </span>
          <br />
          <Typewriter />
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.52 }}
          className="max-w-2xl text-lg sm:text-xl text-white/45 leading-relaxed mb-10">
          Turn documents, YouTube videos, podcasts, audio lectures, and web articles into AI summaries,
          mind maps, flashcards, quizzes — and track your mastery with spaced repetition.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center gap-4">
          <motion.button onClick={go} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="group flex items-center gap-2.5 text-base font-bold px-8 py-4 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #059669, #0891b2)',
              boxShadow: '0 0 48px rgba(6,182,212,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}>
            <GraduationCap className="w-5 h-5" />
            Start for Free
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </motion.button>
          <button onClick={go}
            className="flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl transition-all hover:bg-white/8"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            {isAuthenticated ? 'Open App' : 'Sign In'} <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
        {/* {googleError && <p className="mt-4 text-sm text-red-300">{googleError}</p>} */}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="flex flex-wrap justify-center gap-5 mt-14">
          {[
            { to: 10, suffix: '+', label: 'AI-powered tools' },
            { to: 100, suffix: '%', label: 'Free to start' },
            { to: 5, suffix: ' content types', label: '' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.98 + i * 0.1 }}
              className="flex flex-col items-center px-6 py-3 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(6,182,212,0.15)' }}>
              <span className="text-2xl font-extrabold"
                style={{
                  background: 'linear-gradient(135deg, #22d3ee, #14b8a6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontFamily: 'Orbitron, sans-serif',
                }}>
                <Counter to={s.to} suffix={s.suffix} />
              </span>
              <span className="text-xs text-white/40 mt-0.5">{s.label || s.suffix.replace(/\d/g, '')}</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full flex items-start justify-center pt-1.5"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="w-1 h-2 rounded-full bg-cyan-400 opacity-70" />
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════ BENTO FEATURES ══════════════════════════════ */}
      <section className="relative py-24 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(6,182,212,0.4), transparent)' }} />

        <FadeIn className="text-center mb-14">
          <Badge icon={Sparkles} label="Everything in one place" />
          <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <span style={{ background: 'linear-gradient(135deg, #e0f7ff, #a5f3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Your Complete</span>{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #0891b2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Study Suite</span>
          </h2>
          <p className="mt-4 text-white/40 max-w-lg mx-auto">8+ AI-powered tools working together for every study session.</p>
        </FadeIn>

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-auto">
          <FadeIn delay={0}>
            <BentoCard gradient="from-teal-500 via-cyan-500 to-sky-600" glow="rgba(20,184,166,0.3)" icon={Bot} title="AI Chat & Summaries" desc="Chat with your documents, videos, audio, podcasts, and web articles using AI. Get streaming summaries, ask questions." />
          </FadeIn>
          <FadeIn delay={0.05}>
            <BentoCard gradient="from-emerald-400 via-teal-500 to-cyan-600" glow="rgba(52,211,153,0.3)" icon={Map} title="Mind Maps" desc="Visualize any document as an interactive mind map — grasp structure at a glance." />
          </FadeIn>
          <FadeIn delay={0.05}>
            <BentoCard gradient="from-fuchsia-500 to-pink-600" glow="rgba(217,70,239,0.3)" icon={Trophy} title="AI Quizzes" desc="Question Bank with filtering & pagination, Review Mistakes tab, timed mock exam, and shareable quiz links." />
          </FadeIn>
          <FadeIn delay={0.18}>
            <BentoFlashcardCard />
          </FadeIn>
          <FadeIn delay={0.18}>
            <BentoNoteCard />
          </FadeIn>
          <FadeIn delay={0.18}>
            <BentoGlossaryCard />
          </FadeIn>
          <FadeIn delay={0.30}>
            <BentoProblemCard />
          </FadeIn>
          <FadeIn delay={0.30}>
            <BentoPlayCard />
          </FadeIn>
          <FadeIn delay={0.30}>
            <BentoStudyGroupCard />
          </FadeIn>
          <FadeIn delay={0.34}>
            <BentoCard gradient="from-cyan-400 to-blue-600" glow="rgba(34,211,238,0.3)" icon={Search} title="Global Search" desc="Instant full-text search across all documents, videos, notes, and flashcards." />
          </FadeIn>
          <FadeIn delay={0.42} className="lg:col-span-2 lg:row-span-1">
            <BentoCard gradient="from-teal-500 via-cyan-600 to-sky-700" glow="rgba(13,148,136,0.35)" icon={Share2} title="Share Content Publicly" desc="Share summaries, mind maps, quizzes, flashcard sets, article clips, YouTube videos, and Apple Podcasts with a single public link. Anyone can study from them — no account needed." wide />
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════ OPEN SOURCE + AI PROVIDERS ══════════════════ */}
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
                {[
                  { name: 'Google Gemini', id: 'gemini', color: '#22d3ee', keyHint: 'AIza...', free: 'Free tier', url: 'aistudio.google.com', model: 'gemini-2.0-flash' },
                  { name: 'OpenAI', id: 'openai', color: '#4ade80', keyHint: 'sk-...', free: 'Pay-as-you-go', url: 'platform.openai.com', model: 'gpt-4o-mini' },
                  { name: 'Claude', id: 'claude', color: '#fb923c', keyHint: 'sk-ant-...', free: 'Free tier', url: 'console.anthropic.com', model: 'claude-haiku' },
                  { name: 'Grok', id: 'grok', color: '#facc15', keyHint: 'xai-...', free: 'Free tier', url: 'console.x.ai', model: 'grok-3-mini' },
                  { name: 'DeepSeek', id: 'deepseek', color: '#60a5fa', keyHint: 'sk-...', free: 'Very cheap', url: 'platform.deepseek.com', model: 'deepseek-chat' },
                  { name: 'Kimi', id: 'kimi', color: '#a78bfa', keyHint: 'sk-...', free: 'Free credits', url: 'platform.moonshot.cn', model: 'moonshot-v1-8k' },
                  { name: 'Doubao', id: 'doubao', color: '#f87171', keyHint: 'custom', free: 'Low cost', url: 'ark.volcengine.com', model: 'doubao-pro' },
                  { name: 'Qwen', id: 'qwen', color: '#34d399', keyHint: 'sk-...', free: 'Free credits', url: 'dashscope.aliyuncs.com', model: 'qwen-plus' },
                  { name: 'Wenxin Yiyan', id: 'wenxin', color: '#38bdf8', keyHint: 'bce-v3/...', free: 'Free tier', url: 'console.bce.baidu.com/qianfan', model: 'ernie-4.0-8k' },
                ].map((p, i) => (
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
                        {/* <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${p.color}18`, color: p.color }}>
                          {p.free}
                        </span> */}
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

      {/* ══════════════════ HOW IT WORKS ════════════════════════════════ */}
      <section className="relative py-24 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.4), transparent)' }} />

        <FadeIn className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge icon={Zap} label="Simple as 1, 2, 3" />
            <h2 className="text-4xl sm:text-5xl font-extrabold"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #e0f7ff, #22d3ee 50%, #14b8a6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[calc(33%+2rem)] right-[calc(33%+2rem)] h-px"
              style={{ background: 'linear-gradient(to right, rgba(6,182,212,0.4), rgba(13,148,136,0.4))' }} />
            {[
              { step: '01', title: 'Add Your Content', desc: 'Upload PDFs, paste a YouTube link, clip a web article, add audio files, or paste an Apple Podcasts URL.', icon: BookOpen, color: 'from-cyan-500 to-blue-600', glow: 'rgba(6,182,212,0.4)' },
              { step: '02', title: 'AI Does the Work', desc: 'AI instantly generates summaries, mind maps, flashcards, quizzes, glossaries, and step-by-step worked problems.', icon: Bot, color: 'from-teal-400 to-cyan-600', glow: 'rgba(13,148,136,0.4)' },
              { step: '03', title: 'Master the Topic', desc: 'Review due cards with FSRS spaced repetition, take timed mock exams, annotate PDFs, and explore your Knowledge Graph.', icon: GraduationCap, color: 'from-emerald-400 to-teal-600', glow: 'rgba(52,211,153,0.4)' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <FadeIn key={i} delay={0.15 * i}>
                  <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center text-center p-8 rounded-3xl relative"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: 'rgba(2,8,16,0.95)', border: '1px solid rgba(6,182,212,0.3)', color: '#22d3ee', fontFamily: 'Orbitron, sans-serif' }}>
                      {item.step}
                    </div>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-gradient-to-br ${item.color}`}
                      style={{ boxShadow: `0 8px 28px ${item.glow}` }}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                  </motion.div>
                </FadeIn>
              );
            })}
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════ CTA BANNER ══════════════════════════════════ */}
      <section className="relative py-24 px-6">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center relative">
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            <div className="relative px-8 py-16 rounded-3xl"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(6,182,212,0.2)', boxShadow: '0 0 80px rgba(6,182,212,0.06)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
                className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full"
                style={{ background: 'conic-gradient(from 0deg, #22d3ee, #14b8a6, #059669, #22d3ee)', filter: 'blur(2px)', opacity: 0.5 }} />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(2,8,16,0.95)', border: '1px solid rgba(6,182,212,0.25)' }}>
                <GraduationCap className="w-6 h-6 text-cyan-400" />
              </div>

              <div className="mt-4">
                <Badge icon={Sparkles} label="Ready to level up?" />
              </div>

              <h2 className="text-4xl sm:text-5xl font-extrabold mb-3 leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <span style={{ background: 'linear-gradient(135deg, #e0f7ff, #22d3ee 40%, #14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Start with toto.ai
                </span>
              </h2>
              <p className="text-white/40 text-base mb-10 max-w-md mx-auto leading-relaxed">
                Join learners using AI to study smarter. Free to start — no credit card required.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.button onClick={go} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2.5 text-base font-bold px-8 py-4 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 0 48px rgba(13,148,136,0.45), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
                  <GraduationCap className="w-5 h-5" />
                  Create Free Account
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
                <button onClick={go}
                  className="text-sm font-semibold text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
                  Already have an account? Sign in <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════ FOOTER ══════════════════════════════════════ */}
      <footer className="py-10 px-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-center mb-3">
          <Logo sm />
        </div>
        <p className="text-xs text-white/18 mt-2">easy study platform · built to help you learn faster with AI.</p>
      </footer>
    </div>
  );
};

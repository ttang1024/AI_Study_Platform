import React from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  ArrowRight,
  Zap, ChevronRight, GraduationCap,
  Github, ExternalLink,
} from 'lucide-react';
import { useOptionalAuth } from '../context/AuthContext';
import { Typewriter, Counter, Particles, FadeIn } from '../components/landing/LandingAnimations';
import { Logo, LOGO_STYLES } from '../components/landing/Logo';
import { Badge } from '../components/landing/Badge';
import { ProvidersSection } from '../components/landing/ProvidersSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { CtaSection } from '../components/landing/CtaSection';
import { useGoogleOneTap } from '../hooks/useGoogleOneTap';
import {
  BentoFlashcardCard,
  BentoNoteCard,
  BentoPlayCard,
  BentoGlossaryCard,
  BentoProblemCard,
  BentoStudyGroupCard,
  BentoChatCard,
  BentoMindMapCard,
  BentoQuizCard,
  BentoPlannerCard,
  BentoTutorCard,
  BentoInsightsCard,
  BentoSearchCard,
  BentoShareCard,
  BentoPracticeCard,
  BentoHandwritingCard,
  BentoKnowledgeGraphCard,
  BentoOfflineCard,
  BentoEverywhereCard,
  BentoClassroomCard,
  BentoEssayCard,
  BentoCodeCard,
  BentoLanguageCard,
  BentoCitationCard,
} from '../components/landing/bento';

export const LandingPage: React.FC = () => {
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const username = auth?.user?.name || auth?.user?.email || 'Open app';
  const go = () => window.location.assign(isAuthenticated ? '/summarizer' : '/login');
  useGoogleOneTap();

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
          Turn any document, video, podcast, or article into AI summaries, mind maps, flashcards, and quizzes —
          then master it with spaced repetition, mock exams, and a voice tutor. Web, iOS &amp; Android, even offline.
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
            { to: 25, suffix: '+', label: 'AI-powered tools' },
            { to: 100, suffix: '%', label: 'Free to start' },
            { to: 12, suffix: ' content types', label: '' },
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
          <p className="mt-4 text-white/40 max-w-lg mx-auto">25+ AI-powered tools working together — for a solo cram session or a whole classroom.</p>
        </FadeIn>

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-auto">
          <FadeIn delay={0}>
            <BentoChatCard />
          </FadeIn>
          <FadeIn delay={0.05}>
            <BentoMindMapCard />
          </FadeIn>
          <FadeIn delay={0.05}>
            <BentoQuizCard />
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
          <FadeIn delay={0.24}>
            <BentoPlannerCard />
          </FadeIn>
          <FadeIn delay={0.24}>
            <BentoTutorCard />
          </FadeIn>
          <FadeIn delay={0.24}>
            <BentoInsightsCard />
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
            <BentoPracticeCard />
          </FadeIn>
          <FadeIn delay={0.34}>
            <BentoHandwritingCard />
          </FadeIn>
          <FadeIn delay={0.34}>
            <BentoKnowledgeGraphCard />
          </FadeIn>
          <FadeIn delay={0.38}>
            <BentoCitationCard />
          </FadeIn>
          <FadeIn delay={0.38}>
            <BentoEssayCard />
          </FadeIn>
          <FadeIn delay={0.38}>
            <BentoCodeCard />
          </FadeIn>
          <FadeIn delay={0.42} className="lg:col-span-2 lg:row-span-1">
            <BentoClassroomCard />
          </FadeIn>
          <FadeIn delay={0.42}>
            <BentoLanguageCard />
          </FadeIn>
          <FadeIn delay={0.46}>
            <BentoOfflineCard />
          </FadeIn>
          <FadeIn delay={0.46} className="lg:col-span-2 lg:row-span-1">
            <BentoEverywhereCard />
          </FadeIn>
          <FadeIn delay={0.50}>
            <BentoSearchCard />
          </FadeIn>
          <FadeIn delay={0.50} className="lg:col-span-2 lg:row-span-1">
            <BentoShareCard />
          </FadeIn>
        </div>
      </section>

      <ProvidersSection />

      <HowItWorksSection />

      <CtaSection go={go} />

      {/* ══════════════════ FOOTER ══════════════════════════════════════ */}
      <footer className="py-10 px-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-center mb-3">
          <Logo sm />
        </div>
        <p className="text-xs text-white mt-2">easy study platform · built to help you learn faster with AI.</p>
      </footer>
    </div>
  );
};

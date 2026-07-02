import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ChevronRight, GraduationCap, Sparkles } from 'lucide-react';
import { FadeIn } from './LandingAnimations';
import { Badge } from './Badge';

export const CtaSection: React.FC<{ go: () => void }> = ({ go }) => (
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
          <p className="text-white/50 text-base mb-10 max-w-md mx-auto leading-relaxed">
            Free to start — no credit card required.
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
              className="text-sm font-semibold text-white/50 hover:text-white transition-colors flex items-center gap-1">
              Already have an account? Sign in <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </FadeIn>
  </section>
);

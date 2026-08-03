import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, Bot, GraduationCap, Zap } from 'lucide-react';
import { FadeIn } from './LandingAnimations';
import { Badge } from './Badge';

const STEPS = [
  { step: '01', title: 'Add Your Content', desc: 'Documents in 230+ formats, any video or podcast link, web articles, audio — drop it in and we detect the rest.', icon: BookOpen, color: 'from-cyan-500 to-blue-600', glow: 'rgba(6,182,212,0.4)' },
  { step: '02', title: 'AI Does the Work', desc: 'Summaries, mind maps, flashcards, quizzes, and worked problems in seconds.', icon: Bot, color: 'from-teal-400 to-cyan-600', glow: 'rgba(13,148,136,0.4)' },
  { step: '03', title: 'Master the Topic', desc: 'One-button smart sessions, timed mock exams, graded essays, a Knowledge Graph — and a verifiable certificate at the end.', icon: GraduationCap, color: 'from-emerald-400 to-teal-600', glow: 'rgba(52,211,153,0.4)' },
];

export const HowItWorksSection: React.FC = () => (
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
        {STEPS.map((item, i) => {
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
);

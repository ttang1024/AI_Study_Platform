import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Github } from 'lucide-react';

const DOCKER_LINES = [
  { prompt: '~', cmd: 'git clone https://github.com/ttang1024/AI_Study_Platform', color: '#4ade80' },
  { prompt: '~', cmd: 'cd AI_Study_Platform', color: '#4ade80' },
  { prompt: '~/AI_Study_Platform', cmd: 'cp .env.example .env  # fill values', color: '#4ade80' },
  { prompt: '~/AI_Study_Platform', cmd: 'docker compose up --build -d', color: '#22d3ee' },
  { prompt: '~/AI_Study_Platform', cmd: 'docker compose exec api dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API', color: '#fb923c' },
  { prompt: null, cmd: '✓ API :5000  ·  Web :3000  ·  Admin :4200', color: '#818cf8' },
];

const LOCAL_LINES = [
  { prompt: '~', cmd: 'azurite-blob --blobHost 127.0.0.1 --blobPort 10000 &', color: '#f0abfc' },
  { prompt: null, cmd: '✓ Azurite blob ready on :10000', color: '#818cf8' },
  { prompt: '~/Study_Platform/server', cmd: 'dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API', color: '#fb923c' },
  { prompt: null, cmd: '✓ Migrations applied', color: '#818cf8' },
  { prompt: '~/Study_Platform/server', cmd: 'dotnet run --project StudyPlatform.API', color: '#22d3ee' },
  { prompt: null, cmd: '✓ API → http://localhost:5000', color: '#818cf8' },
  { prompt: '~/Study_Platform/web', cmd: 'npm install && npm run dev', color: '#4ade80' },
  { prompt: null, cmd: '✓ Web → http://localhost:3000', color: '#818cf8' },
];

const AZURE_LINES = [
  { prompt: '~', cmd: 'az login', color: '#38bdf8' },
  { prompt: '~/Study_Platform', cmd: 'export DB_PASS=... JWT_SECRET=...', color: '#4ade80' },
  { prompt: '~/Study_Platform', cmd: 'export GOOGLE_CLIENT_ID=... GITHUB_CLIENT_ID=...', color: '#4ade80' },
  { prompt: '~/Study_Platform', cmd: 'export SMTP_USER=... SMTP_PASSWORD=...', color: '#4ade80' },
  { prompt: '~/Study_Platform', cmd: 'bash deploy.sh', color: '#22d3ee' },
  { prompt: null, cmd: '✓ API on Container Apps · Web/Admin on Storage', color: '#818cf8' },
];

type DeployTab = 'local' | 'docker' | 'azure';

export const TerminalCard: React.FC = () => {
  const [tab, setTab] = useState<DeployTab>('local');
  const lines = tab === 'docker' ? DOCKER_LINES : tab === 'azure' ? AZURE_LINES : LOCAL_LINES;

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(74,222,128,0.2)', boxShadow: '0 0 40px rgba(74,222,128,0.06)' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
          <Terminal className="w-3.5 h-3.5 text-white/20 ml-2" />
          <span className="text-xs text-white/20 ml-1">bash</span>
          <div className="ml-auto flex gap-1">
            {(['local', 'docker', 'azure'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors"
                style={tab === t
                  ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {t === 'docker' ? 'Docker' : t === 'azure' ? 'Azure' : 'Local'}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-5 font-mono text-sm space-y-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-2"
            >
              {lines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-2"
                >
                  {line.prompt && (
                    <span className="shrink-0 text-white/25">{line.prompt} $</span>
                  )}
                  <span style={{ color: line.color }}>{line.cmd}</span>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-white/25">~ $</span>
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ color: '#4ade80' }}
            >▋</motion.span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: 'MIT License', color: '#4ade80' },
          { label: 'Self-hostable', color: '#f0abfc' },
          { label: 'No subscriptions', color: '#818cf8' },
        ].map(t => (
          <span
            key={t.label}
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: `${t.color}12`, color: t.color, border: `1px solid ${t.color}30` }}
          >
            {t.label}
          </span>
        ))}
      </div>

      <motion.a
        href="https://github.com/ttang1024/AI_Study_Platform"
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl font-bold text-sm"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(74,222,128,0.3)',
          color: '#4ade80',
          boxShadow: '0 0 24px rgba(74,222,128,0.08)',
        }}
      >
        <Github className="w-4 h-4" />
        GitHub
        <span className="text-xs text-white/30 font-normal">→ free forever</span>
      </motion.a>
    </div>
  );
};

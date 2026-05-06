import React, { useState, useRef } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, X, Loader2, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { DocumentCard } from '../common/DocumentCard';
import { usePrompt } from '../common/PromptBox';
import { useStudy } from '../../context/StudyContext';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { getApiErrorMessage } from '../../utils/apiError';

const container = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const AUDIO_TYPES = [
  { label: 'MP3', color: 'text-amber-500 bg-amber-50' },
  { label: 'M4A', color: 'text-teal-500 bg-teal-50' },
  { label: 'WAV', color: 'text-zinc-400 bg-zinc-50' },
  { label: 'OGG', color: 'text-emerald-400 bg-emerald-50' },
];

export interface AudioTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export const AudioTab: React.FC<AudioTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { refreshStats, documents, courses } = useStudy();
  const { showPrompt } = usePrompt();
  const recentAudios = documents.filter(d => d.type === 'audio').slice(0, 3);
  const getCourse = (id?: string) => courses.find(c => c.id === id);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const validateAndSetFile = (f: File) => {
    const exts = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (!f.type.startsWith('audio/') && !exts.includes(ext)) {
      showPrompt('Unsupported format. Please upload an audio file (MP3, M4A, WAV, OGG).');
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      showPrompt('File size exceeds 100 MB limit.');
      return;
    }
    setAudioFile(f);
  };

  const handleUpload = async () => {
    if (!audioFile) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setUploading(true);
    setProgress(0);
    try {
      let p = 0;
      const interval = setInterval(() => {
        p += 2;
        if (p < 90) setProgress(p);
        else clearInterval(interval);
      }, 120);
      const formData = new FormData();
      formData.append('file', audioFile);
      const res = await apiClient.post(
        `/api/courses/${selectedCourseId}/audio/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      clearInterval(interval);
      setProgress(100);
      refreshStats();
      const docId = res.data.data.documentId;
      setTimeout(() => navigate(`/audio/${docId}`, { state: { courseId: selectedCourseId } }), 500);
    } catch (error) {
      setUploading(false);
      setProgress(0);
      showPrompt(getApiErrorMessage(error, 'Upload failed.'));
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div
        variants={item}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); validateAndSetFile(e.dataTransfer.files[0]); }}
        className={cn(
          'group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-500 overflow-hidden cursor-pointer h-60',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : audioFile
              ? 'border-emerald-400 bg-emerald-50/50'
              : 'border-zinc-200 bg-white hover:border-primary/40 hover:bg-primary/[0.02]',
        )}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <input
          ref={audioInputRef}
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0 z-10"
          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }}
          accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"
        />
        <AnimatePresence mode="wait">
          {!audioFile ? (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
              className="relative z-10 flex flex-col items-center gap-3 pointer-events-none text-center px-6"
            >
              <div className="relative">
                <div className={cn('absolute inset-0 blur-xl opacity-0 transition-opacity duration-500 rounded-2xl', isDragging ? 'opacity-30 bg-primary' : 'group-hover:opacity-20 bg-primary')} />
                <div className={cn('relative rounded-2xl p-4 text-white shadow-lg transition-all duration-500', isDragging ? 'bg-primary scale-110 -rotate-3' : 'bg-primary group-hover:scale-105 group-hover:-rotate-2')}>
                  <Mic size={28} />
                </div>
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-zinc-900">{isDragging ? 'Release to upload' : 'Drop your audio file here'}</p>
                <p className="mt-0.5 text-zinc-400 text-xs">or click to browse</p>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {AUDIO_TYPES.map(({ label, color }) => (
                  <div key={label} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold', color)}>
                    {label}
                  </div>
                ))}
                <span className="text-[11px] text-zinc-400 font-medium">· max 100 MB</span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0, scale: 0.9, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative z-10 flex flex-col items-center gap-3 pointer-events-none"
            >
              <div className="relative pointer-events-auto">
                <div className="relative rounded-2xl bg-emerald-500 p-4 text-white shadow-lg shadow-emerald-100">
                  <Mic size={28} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setAudioFile(null); if (audioInputRef.current) audioInputRef.current.value = ''; }}
                  className="absolute -right-2 -top-2 rounded-full bg-white p-1.5 text-zinc-400 shadow-lg hover:text-red-500 hover:scale-110 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="text-center">
                <p className="text-base font-black tracking-tight text-zinc-900 truncate max-w-[260px]">{audioFile.name}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">{(audioFile.size / 1024 / 1024).toFixed(2)} MB · Ready</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {uploading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span className="text-sm font-bold text-text-main">Transcribing Audio</span>
              </div>
              <span className="text-sm font-black text-primary">{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
              <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item}>
        <Button
          disabled={!audioFile || uploading}
          onClick={handleUpload}
          className={cn(
            'h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300',
            audioFile && !uploading && selectedCourseId
              ? 'bg-primary text-white shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95'
              : 'bg-zinc-100 text-zinc-400',
          )}
        >
          {uploading
            ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Processing...</span>
            : <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Start Learning</span>}
        </Button>
      </motion.div>

      {recentAudios.length > 0 && (
        <motion.div variants={item} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-main">Recent Audios</h3>
            <RouterLink to="/library?type=audio" className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
              View All <ArrowRight size={12} />
            </RouterLink>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentAudios.map(doc => (
              <DocumentCard key={doc.id} doc={doc} course={getCourse(doc.courseId)} to={`/audio/${doc.id}`} compact />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

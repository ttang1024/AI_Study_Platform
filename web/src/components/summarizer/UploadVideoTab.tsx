import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileVideo, Loader2, ShieldCheck, Upload, X, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { VideoCard } from '../common/VideoCard';
import { usePrompt } from '../common/PromptBox';
import { useStudy } from '../../context/StudyContext';
import { videoService, VideoListItem } from '../../services/videoService';
import { cn } from '../../utils/cn';
import { getApiErrorMessage } from '../../utils/apiError';
import { DuplicateAlert } from './DuplicateAlert';

const container = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const VIDEO_TYPES = ['MP4', 'MOV', 'WEBM', 'MKV'];

export interface UploadVideoTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

async function captureFirstFrame(file: File): Promise<Blob | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    let settled = false;
    const timeout = window.setTimeout(() => finish(), 5000);

    const finish = (blob?: Blob) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      resolve(blob);
    };

    video.onerror = () => finish();
    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.1, Math.max(0, (video.duration || 1) - 0.01));
      } catch {
        finish();
      }
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => finish(blob ?? undefined), 'image/jpeg', 0.82);
      } catch {
        finish();
      }
    };
  });
}

export const UploadVideoTab: React.FC<UploadVideoTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { refreshStats } = useStudy();
  const { showPrompt } = usePrompt();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedVideos, setUploadedVideos] = useState<VideoListItem[]>([]);

  // The lite list so duplicate detection sees the whole library, not just the newest page.
  const loadUploadedVideos = useCallback(() => {
    videoService.getVideosLite({ pageSize: 500 })
      .then(data => setUploadedVideos(data.items.filter(v => v.sourceType === 'upload')))
      .catch(() => { });
  }, []);

  useEffect(() => { loadUploadedVideos(); }, [loadUploadedVideos]);

  // Uploaded videos carry no file hash server-side (their id is generated, not derived from the
  // bytes), so the file name — which is what the upload stores as the title — is the only signal.
  const baseName = (name: string) => name.replace(/\.[^.]+$/, '').trim().toLowerCase();
  const duplicateVideo = file
    ? uploadedVideos.find(v => v.title.trim().toLowerCase() === baseName(file.name)) ?? null
    : null;

  const validateAndSetFile = (f?: File) => {
    if (!f) return;
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.wmv', '.flv', '.3gp', '.3g2', '.ts', '.mts', '.m2ts', '.mpg', '.mpeg', '.ogv', '.vob', '.asf'];
    if (!f.type.startsWith('video/') && !allowed.includes(ext)) {
      showPrompt('Unsupported format. Please upload a video file (MP4, MOV, WEBM, MKV, AVI, WMV, FLV, 3GP, TS, MPG, OGV, VOB, ASF).');
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      showPrompt('File size exceeds 500 MB limit.');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    // Already uploaded — the DuplicateAlert offers the "View" path instead.
    if (duplicateVideo) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setUploading(true);
    setProgress(0);
    try {
      let p = 0;
      const interval = setInterval(() => {
        p += 1;
        if (p < 90) setProgress(p);
        else clearInterval(interval);
      }, 180);
      const thumbnail = await captureFirstFrame(file);
      const saved = await videoService.uploadVideo(selectedCourseId, file, thumbnail);
      clearInterval(interval);
      setProgress(100);
      refreshStats();
      loadUploadedVideos();
      const returnTo = `/summarizer?tab=video&courseId=${encodeURIComponent(selectedCourseId)}`;
      setTimeout(() => navigate(`/videos/${saved.id}`, { state: { returnTo } }), 400);
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
          'group relative flex h-60 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all duration-500',
          isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : file ? 'border-emerald-400 bg-emerald-50/50' : 'border-zinc-200 bg-white hover:border-primary/40 hover:bg-primary/[0.02]',
        )}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <input
          ref={inputRef}
          type="file"
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.wmv,.flv,.3gp,.3g2,.ts,.mts,.m2ts,.mpg,.mpeg,.ogv,.vob,.asf"
          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
          onChange={(e) => validateAndSetFile(e.target.files?.[0])}
        />
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="relative z-10 flex flex-col items-center gap-3 px-6 text-center pointer-events-none">
              <div className="relative rounded-2xl bg-primary p-4 text-white shadow-lg">
                <Upload size={28} />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-zinc-900">{isDragging ? 'Release to upload' : 'Drop your video file here'}</p>
                <p className="mt-0.5 text-xs text-zinc-400">or click to browse</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {VIDEO_TYPES.map(label => (
                  <div key={label} className="rounded-full bg-zinc-50 px-3 py-1 text-[11px] font-bold text-zinc-500">{label}</div>
                ))}
                <span className="text-[11px] font-medium text-zinc-400">· max 500 MB</span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0, scale: 0.9, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative z-10 flex flex-col items-center gap-3 pointer-events-none">
              <div className="relative pointer-events-auto">
                <div className="relative rounded-2xl bg-emerald-500 p-4 text-white shadow-lg shadow-emerald-100">
                  <FileVideo size={28} />
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ''; }} className="absolute -right-2 -top-2 rounded-full bg-white p-1.5 text-zinc-400 shadow-lg transition-all hover:scale-110 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
              <div className="text-center">
                <p className="max-w-[260px] truncate text-base font-black tracking-tight text-zinc-900">{file.name}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">{(file.size / 1024 / 1024).toFixed(2)} MB · Ready</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {duplicateVideo && (
          <DuplicateAlert
            label="video file"
            courseName={duplicateVideo.courseName}
            to={`/videos/${duplicateVideo.id}`}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span className="text-sm font-bold text-text-main">Uploading and transcribing video</span>
              </div>
              <span className="text-sm font-black text-primary">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item}>
        <Button disabled={!file || uploading || !!duplicateVideo} onClick={handleUpload} className={cn('h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300', file && !uploading && selectedCourseId && !duplicateVideo ? 'bg-primary text-white shadow-primary/20 hover:scale-[1.02] hover:shadow-primary/40 active:scale-95' : 'bg-zinc-100 text-zinc-400')}>
          {uploading
            ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Processing...</span>
            : duplicateVideo
              ? <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Already in Library</span>
              : <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Analyze Video</span>}
        </Button>
      </motion.div>

      {uploadedVideos.length > 0 && (
        <motion.div variants={item} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-main">Recent Uploads</h3>
            <RouterLink to="/library?type=videos" className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
              View All <ArrowRight size={12} />
            </RouterLink>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uploadedVideos.slice(0, 3).map(video => (
              <VideoCard
                key={video.id}
                video={video}
                to={`/videos/${video.id}`}
                compact
                onDeleted={() => setUploadedVideos(prev => prev.filter(v => v.id !== video.id))}
                onMoved={(newCourseId) => setUploadedVideos(prev => prev.map(v => v.id === video.id ? { ...v, courseId: newCourseId } : v))}
                onUpdated={(updated) => setUploadedVideos(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v))}
              />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

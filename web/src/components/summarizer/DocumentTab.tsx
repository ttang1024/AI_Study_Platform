import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, File, X, Loader2, ShieldCheck, Zap, FileText, BookOpen, ArrowRight, Image, Presentation, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { DocumentCard } from '../common/DocumentCard';
import { usePrompt } from '../common/PromptBox';
import { useStudy } from '../../context/StudyContext';
import { cn } from '../../utils/cn';
import { getApiErrorMessage } from '../../utils/apiError';
import { calculateSha256 } from '../../utils/fileHash';
import { DuplicateAlert } from './DuplicateAlert';
import { getDuplicateDocRoute } from './duplicateDocRoute';
import { DOCUMENT_ACCEPT_ATTR, isAcceptedDocumentFile } from '../../constants/documentUpload';

const container = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const FILE_TYPES = [
  { icon: BookOpen, label: 'PDF', color: 'text-red-400 bg-red-50' },
  { icon: Image, label: 'Image', color: 'text-violet-500 bg-violet-50' },
  { icon: Presentation, label: 'PPT', color: 'text-orange-500 bg-orange-50' },
  { icon: FileText, label: 'Word', color: 'text-blue-500 bg-blue-50' },
  { icon: FileText, label: 'Excel', color: 'text-green-600 bg-green-50' },
  { icon: FileText, label: 'TXT', color: 'text-zinc-400 bg-zinc-50' },
  { icon: BookOpen, label: 'eBook', color: 'text-emerald-500 bg-emerald-50' },
  { icon: FileText, label: 'Code', color: 'text-sky-500 bg-sky-50' },
  { icon: FileText, label: 'Subtitles', color: 'text-amber-500 bg-amber-50' },
];

export interface DocumentTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export const DocumentTab: React.FC<DocumentTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { addDocument, documents, courses, ensureDocuments } = useStudy();
  const { showPrompt } = usePrompt();
  // documents is loaded lazily by StudyContext; pull it for the recent list and
  // duplicate detection.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);
  const recentDocs = documents.filter(d => d.type !== 'audio' && d.type !== 'podcast' && !d.originalUrl).slice(0, 3);
  const getCourse = (id?: string) => courses.find(c => c.id === id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFileHash(null);
    if (!file) return;

    calculateSha256(file)
      .then(hash => { if (!cancelled) setFileHash(hash); })
      .catch(() => { if (!cancelled) setFileHash(null); });

    return () => { cancelled = true; };
  }, [file]);

  const duplicateDoc = !uploading && fileHash
    ? documents.find(doc => doc.fileHash === fileHash) ?? null
    : null;
  const duplicateDocCourse = duplicateDoc?.courseId ? courses.find(c => c.id === duplicateDoc.courseId) : undefined;

  const validateAndSetFile = (f: File) => {
    if (!isAcceptedDocumentFile(f)) {
      showPrompt('Unsupported file format. Please upload a PDF, Image, Office, OpenDocument/StarOffice, iWork, text/Markdown/HTML/RTF/LaTeX, CSV/JSON/XML/YAML/TOML, notebook, subtitle or caption, source code, or eBook file.');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      showPrompt('File size exceeds 50MB limit. Please upload a smaller file.');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    // Already uploaded — the server rejects it with DUPLICATE_DOCUMENT anyway; the
    // DuplicateAlert offers the "View" path instead.
    if (duplicateDoc) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setUploading(true);
    setProgress(0);
    try {
      let p = 0;
      const interval = setInterval(() => {
        p += 3;
        if (p < 90) setProgress(p);
        else clearInterval(interval);
      }, 100);
      const docId = await addDocument(file, selectedCourseId);
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => navigate(`/documents/${docId}`), 500);
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
            : file
              ? 'border-emerald-400 bg-emerald-50/50'
              : 'border-zinc-200 bg-white hover:border-primary/40 hover:bg-primary/[0.02]',
        )}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <input
          ref={fileInputRef}
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0 z-10"
          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }}
          accept={DOCUMENT_ACCEPT_ATTR}
        />
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
              className="relative z-10 flex flex-col items-center gap-3 pointer-events-none text-center px-6"
            >
              <div className="relative">
                <div className={cn('absolute inset-0 blur-xl opacity-0 transition-opacity duration-500 rounded-2xl', isDragging ? 'opacity-30 bg-primary' : 'group-hover:opacity-20 bg-primary')} />
                <div className={cn('relative rounded-2xl p-4 text-white shadow-lg transition-all duration-500', isDragging ? 'bg-primary scale-110 -rotate-3' : 'bg-primary group-hover:scale-105 group-hover:-rotate-2')}>
                  <Upload size={28} />
                </div>
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-zinc-900">{isDragging ? 'Release to upload' : 'Drop your file here'}</p>
                <p className="mt-0.5 text-zinc-400 text-xs">or click to browse</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {FILE_TYPES.map(({ icon: Icon, label, color }) => (
                  <div key={label} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold', color)}>
                    <Icon size={11} />{label}
                  </div>
                ))}
                <span className="text-[11px] text-zinc-400 font-medium">· max 50 MB</span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0, scale: 0.9, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative z-10 flex flex-col items-center gap-3 pointer-events-none"
            >
              <div className="relative pointer-events-auto">
                <div className="relative rounded-2xl bg-emerald-500 p-4 text-white shadow-lg shadow-emerald-100">
                  <File size={28} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setFileHash(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute -right-2 -top-2 rounded-full bg-white p-1.5 text-zinc-400 shadow-lg hover:text-red-500 hover:scale-110 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="text-center">
                <p className="text-base font-black tracking-tight text-zinc-900 truncate max-w-[260px]">{file.name}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">{(file.size / 1024 / 1024).toFixed(2)} MB · Ready</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {duplicateDoc && (
          <DuplicateAlert
            label="file"
            courseName={duplicateDocCourse?.name}
            to={getDuplicateDocRoute(duplicateDoc)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span className="text-sm font-bold text-text-main">Analyzing Document</span>
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
          disabled={!file || uploading || !!duplicateDoc}
          onClick={handleUpload}
          className={cn(
            'h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300',
            file && !uploading && selectedCourseId && !duplicateDoc
              ? 'bg-primary text-white shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95'
              : 'bg-zinc-100 text-zinc-400',
          )}
        >
          {uploading
            ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Processing...</span>
            : duplicateDoc
              ? <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Already in Library</span>
              : <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Start Learning</span>}
        </Button>
      </motion.div>

      {recentDocs.length > 0 && (
        <motion.div variants={item} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-main">Recent Documents</h3>
            <RouterLink to="/library" className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
              View All <ArrowRight size={12} />
            </RouterLink>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentDocs.map(doc => (
              <DocumentCard key={doc.id} doc={doc} course={getCourse(doc.courseId)} compact />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

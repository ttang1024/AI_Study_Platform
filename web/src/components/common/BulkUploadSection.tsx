import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, CheckCircle2, Loader2, AlertCircle, AlertTriangle, Files, Plus, CircleFadingArrowUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudy } from '../../context/StudyContext';
import { cn } from '../../utils/cn';
import { getApiErrorMessage } from '../../utils/apiError';
import { calculateSha256 } from '../../utils/fileHash';
import { usePrompt } from './PromptBox';
import { getDuplicateDocRoute } from '../summarizer/duplicateDocRoute';
import { DOCUMENT_ACCEPT_ATTR, isAcceptedDocumentFile } from '../../constants/documentUpload';

function getDocRoute(fileName: string, docId: string): string {
  return fileName.toLowerCase().endsWith('.md') ? `/articles/${docId}` : `/documents/${docId}`;
}

interface FileEntry {
  id: string;
  file: File;
  /** 'duplicate' — same bytes as a library document or as another file in this batch; never uploaded. */
  status: 'pending' | 'hashing' | 'uploading' | 'done' | 'error' | 'duplicate';
  progress: number;
  docId?: string;
  error?: string;
  hash?: string;
  /** Where the existing copy lives — absent when the twin is another not-yet-uploaded file here. */
  duplicateTo?: string;
  duplicateOfName?: string;
}

const isValidFile = isAcceptedDocumentFile;

interface BulkUploadSectionProps {
  selectedCourseId: string;
  onCourseError?: (v: boolean) => void;
}

export const BulkUploadSection: React.FC<BulkUploadSectionProps> = ({ selectedCourseId, onCourseError }) => {
  const { addDocument, documents, ensureDocuments } = useStudy();
  const { showPrompt } = usePrompt();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // documents is loaded lazily by StudyContext; pull it for duplicate detection. Read through a ref
  // because the hashing below resolves asynchronously, after the closure that started it is stale.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);
  const documentsRef = useRef(documents);
  useEffect(() => { documentsRef.current = documents; }, [documents]);

  /** Flags an entry as a duplicate of a library document or of another file in the same batch. */
  const hashAndFlag = async (entryId: string, file: File) => {
    const hash = await calculateSha256(file).catch(() => null);
    setFiles(prev => {
      const current = prev.find(f => f.id === entryId);
      // Removed, or already uploaded by a click that beat the hash.
      if (!current || current.status !== 'hashing') return prev;
      if (!hash) return prev.map(f => f.id === entryId ? { ...f, status: 'pending' } : f);

      const existingDoc = documentsRef.current.find(d => d.fileHash === hash);
      const queuedTwin = prev.find(f => f.id !== entryId && f.hash === hash && f.status !== 'error');
      if (!existingDoc && !queuedTwin) {
        return prev.map(f => f.id === entryId ? { ...f, hash, status: 'pending' } : f);
      }
      return prev.map(f => f.id === entryId
        ? {
          ...f,
          hash,
          status: 'duplicate',
          duplicateTo: existingDoc
            ? getDuplicateDocRoute(existingDoc)
            : queuedTwin?.docId ? getDocRoute(queuedTwin.file.name, queuedTwin.docId) : undefined,
          duplicateOfName: existingDoc ? existingDoc.name : queuedTwin?.file.name,
        }
        : f);
    });
  };

  const addFiles = (newFiles: File[]) => {
    const valid = newFiles.filter(isValidFile);
    const tooLarge = newFiles.filter(f => f.size > 50 * 1024 * 1024);
    if (tooLarge.length > 0) {
      showPrompt(`${tooLarge.length} file(s) exceed the 50MB limit and were skipped.`);
    }
    const entries: FileEntry[] = valid
      .filter(f => f.size <= 50 * 1024 * 1024)
      .map(f => ({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        status: 'hashing',
        progress: 0,
      }));
    setFiles(prev => [...prev, ...entries]);
    entries.forEach(entry => { void hashAndFlag(entry.id, entry.file); });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleUploadAll = async () => {
    if (!selectedCourseId) {
      onCourseError?.(true);
      return;
    }
    onCourseError?.(false);

    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);

    for (const entry of pendingFiles) {
      // Mark as uploading
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'uploading', progress: 10 } : f));

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map(f =>
            f.id === entry.id && f.progress < 85
              ? { ...f, progress: f.progress + 5 }
              : f,
          ));
        }, 150);

        const docId = await addDocument(entry.file, selectedCourseId);
        clearInterval(progressInterval);

        setFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'done', progress: 100, docId } : f,
        ));
      } catch (err) {
        const message = getApiErrorMessage(err, 'Upload failed.');
        showPrompt(message);
        setFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'error', progress: 0, error: message } : f,
        ));
      }
    }

    setIsProcessing(false);
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const doneCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const duplicateCount = files.filter(f => f.status === 'duplicate').length;
  // Uploading while a hash is still in flight could push a file the check would have caught.
  const hashingCount = files.filter(f => f.status === 'hashing').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Files size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-text-main">Batch Upload</h3>
        <span className="text-xs text-text-muted">Upload multiple files at once</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 py-8',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-zinc-200 bg-[var(--bg-sidebar)] hover:border-primary/50 hover:bg-primary/[0.02]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT_ATTR}
          className="hidden"
          onChange={e => { addFiles(Array.from(e.target.files || [])); if (e.target) e.target.value = ''; }}
        />
        <div className={cn('rounded-xl p-3 text-white shadow transition-all', isDragging ? 'bg-primary scale-110' : 'bg-primary/80')}>
          <Upload size={22} />
        </div>
        <div className="text-center">
          <p className="font-bold text-text-main text-sm">{isDragging ? 'Drop files here' : 'Drop multiple files or click to browse'}</p>
          <p className="text-xs text-text-muted mt-0.5">PDF, Office, images, eBooks, text &amp; more · max 50MB each</p>
        </div>
        {files.length > 0 && (
          <span className="absolute top-3 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* File queue */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {files.map(entry => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => {
                  if (entry.status === 'done' && entry.docId) {
                    navigate(getDocRoute(entry.file.name, entry.docId));
                  } else if (entry.status === 'duplicate' && entry.duplicateTo) {
                    navigate(entry.duplicateTo);
                  }
                }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-2.5',
                  entry.status === 'done' ? 'border-emerald-200 bg-emerald-50/50 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors'
                    : entry.status === 'error' ? 'border-red-200 bg-red-50/50'
                      : entry.status === 'duplicate' ? cn('border-amber-200 bg-amber-50/50', entry.duplicateTo && 'cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors')
                        : entry.status === 'uploading' ? 'border-primary/30 bg-primary/5'
                          : 'border-[var(--border-color)] bg-[var(--bg-sidebar)]',
                )}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {entry.status === 'done' && <CheckCircle2 size={16} className="text-emerald-500" />}
                  {entry.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                  {entry.status === 'duplicate' && <AlertTriangle size={16} className="text-amber-500" />}
                  {entry.status === 'uploading' && <Loader2 size={16} className="animate-spin text-primary" />}
                  {entry.status === 'hashing' && <Loader2 size={16} className="animate-spin text-zinc-400" />}
                  {entry.status === 'pending' && <CircleFadingArrowUp size={16} className="text-gray-500" />}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-main truncate">{entry.file.name}</p>
                  {entry.status === 'uploading' && (
                    <div className="mt-1 h-1 w-full rounded-full bg-zinc-100 overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        animate={{ width: `${entry.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                  {entry.status === 'error' && (
                    <p className="text-[10px] text-red-500 mt-0.5">{entry.error}</p>
                  )}
                  {entry.status === 'duplicate' && (
                    <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                      {entry.duplicateTo
                        ? <>Already in your library{entry.duplicateOfName ? ` as “${entry.duplicateOfName}”` : ''} · click to open <ExternalLink size={9} /></>
                        : <>Same file as “{entry.duplicateOfName}” in this batch — skipped</>}
                    </p>
                  )}
                  {entry.status === 'done' && (
                    <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                      Uploaded · click to open <ExternalLink size={9} />
                    </p>
                  )}
                </div>

                {/* Size */}
                <span className="text-[10px] text-text-muted shrink-0">{(entry.file.size / 1024 / 1024).toFixed(1)}MB</span>

                {/* Remove (anything not in flight) */}
                {(entry.status === 'pending' || entry.status === 'duplicate') && (
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(entry.id); }}
                    className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </motion.div>
            ))}

            {/* Summary + Upload All */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3 text-xs text-text-muted">
                {doneCount > 0 && <span className="text-emerald-600 font-bold">{doneCount} done</span>}
                {errorCount > 0 && <span className="text-red-500 font-bold">{errorCount} failed</span>}
                {duplicateCount > 0 && <span className="text-amber-600 font-bold">{duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}</span>}
                {pendingCount > 0 && <span>{pendingCount} pending</span>}
              </div>
              <div className="flex items-center gap-2">
                {!isProcessing && files.some(f => f.status === 'done' || f.status === 'duplicate') && (
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-text-muted hover:text-primary transition-colors"
                  >
                    Clear all
                  </button>
                )}
                {(pendingCount > 0 || hashingCount > 0) && (
                  <button
                    onClick={handleUploadAll}
                    disabled={isProcessing || hashingCount > 0 || pendingCount === 0}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                  >
                    {isProcessing
                      ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
                      : hashingCount > 0
                        ? <><Loader2 size={14} className="animate-spin" /> Checking files...</>
                        : <><Plus size={14} /> Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}</>}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

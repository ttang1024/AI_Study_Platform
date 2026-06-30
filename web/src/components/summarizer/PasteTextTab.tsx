import React, { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, Zap, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { DocumentCard } from '../common/DocumentCard';
import { usePrompt } from '../common/PromptBox';
import { useStudy } from '../../context/StudyContext';
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

const MIN_CHARS = 20;
const MAX_CHARS = 500_000;

export interface PasteTextTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export const PasteTextTab: React.FC<PasteTextTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { addDocument, documents, courses, ensureDocuments } = useStudy();
  const { showPrompt } = usePrompt();
  // documents is loaded lazily by StudyContext; pull it for the recent list.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);
  const recentDocs = documents.filter(d => d.type !== 'audio' && d.type !== 'podcast' && !d.originalUrl).slice(0, 3);
  const getCourse = (id?: string) => courses.find(c => c.id === id);

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const charCount = text.trim().length;
  const canSubmit = charCount >= MIN_CHARS && !submitting;

  const handleSubmit = async () => {
    if (charCount < MIN_CHARS) {
      showPrompt(`Please paste at least ${MIN_CHARS} characters of text.`);
      return;
    }
    if (charCount > MAX_CHARS) {
      showPrompt('Text is too long. Please paste under 500,000 characters.');
      return;
    }
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setSubmitting(true);
    try {
      const baseName = title.trim() || `Pasted Note ${new Date().toLocaleDateString()}`;
      const fileName = baseName.toLowerCase().endsWith('.txt') ? baseName : `${baseName}.txt`;
      const file = new File([text], fileName, { type: 'text/plain' });
      const docId = await addDocument(file, selectedCourseId);
      navigate(`/documents/${docId}`);
    } catch (error) {
      setSubmitting(false);
      showPrompt(getApiErrorMessage(error, 'Failed to create document.'));
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-4">
      <motion.p variants={item} className="text-sm text-text-muted">
        Paste any long text — notes, an article, an essay — and turn it into study material.
      </motion.p>

      <motion.input
        variants={item}
        type="text"
        placeholder="Title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm font-medium outline-none focus:border-primary"
      />

      <motion.div variants={item} className="relative">
        <textarea
          placeholder="Paste your text here..."
          value={text}
          onChange={e => setText(e.target.value)}
          rows={12}
          className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary min-h-[260px]"
        />
        <span className={cn(
          'pointer-events-none absolute bottom-3 right-3 rounded-full bg-zinc-100/90 px-2 py-0.5 text-[11px] font-bold',
          charCount > MAX_CHARS ? 'text-red-500' : 'text-zinc-400',
        )}>
          {charCount.toLocaleString()} chars
        </span>
      </motion.div>

      <motion.div variants={item}>
        <Button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={cn(
            'h-12 w-full rounded-xl text-base font-black shadow-md transition-all duration-300',
            canSubmit && selectedCourseId
              ? 'bg-primary text-white shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95'
              : 'bg-zinc-100 text-zinc-400',
          )}
        >
          {submitting
            ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Processing...</span>
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

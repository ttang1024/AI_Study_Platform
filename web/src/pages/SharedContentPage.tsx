import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2, AlertCircle, FileText, Map, MessageSquare,
  BrainCircuit, BookOpen, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, RotateCcw, Trophy, Clock, Award,
  Check, Copy, User, Calendar, Youtube, Mic, Rss, ExternalLink, Loader2, BookMarked,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ?? '';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderAsync } from 'docx-preview';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { getShare, SharedContent, ShareableQuiz, ShareableCard } from '../services/shareContentService';
import { cn } from '../utils/cn';

// ─── Markmap renderer (no StudyContext dependency) ────────────────────────────

const transformer = new Transformer();

function xmindMarkToMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{')) {
    try {
      const tree = JSON.parse(trimmed) as { title: string; children?: any[] };
      const toMd = (node: { title: string; children?: any[] }, depth = 0): string => {
        if (depth === 0) {
          const kids = (node.children ?? []).map(c => toMd(c, 1)).join('\n');
          return `# ${node.title}${kids ? '\n' + kids : ''}`;
        }
        const indent = '  '.repeat(depth - 1);
        const line = `${indent}- ${node.title}`;
        const kids = (node.children ?? []).map(c => toMd(c, depth + 1)).join('\n');
        return kids ? `${line}\n${kids}` : line;
      };
      return toMd(tree);
    } catch { /* fall through */ }
  }
  const lines = trimmed.split('\n').map(l => l.replace(/\t/g, '    '));
  const out: string[] = [];
  let rootFound = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (!rootFound && !bulletMatch) { out.push(`# ${line.trim()}`); rootFound = true; }
    else if (bulletMatch) {
      rootFound = true;
      const depth = Math.floor(bulletMatch[1].length / 4);
      const title = bulletMatch[2].replace(/\s*\[[^\]]+\]/g, '').trim();
      out.push('  '.repeat(depth) + `- ${title}`);
    }
  }
  return out.join('\n');
}

const MarkmapView: React.FC<{ text: string }> = ({ text }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const markdown = xmindMarkToMarkdown(text);
    const { root } = transformer.transform(markdown);
    if (mmRef.current) {
      mmRef.current.setData(root);
      requestAnimationFrame(() => mmRef.current?.fit());
    } else {
      mmRef.current = Markmap.create(svg, {}, root);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        mmRef.current?.fit();
        svg.style.opacity = '1';
      }));
    }
  }, [text]);

  useEffect(() => () => { mmRef.current?.destroy(); mmRef.current = null; }, []);

  return (
    <svg ref={svgRef} className="w-full" style={{ height: '420px', opacity: 0, transition: 'opacity 0.2s ease' }} />
  );
};

type Tab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'glossary';

// ─── Quiz sub-component ───────────────────────────────────────────────────────

// correctAnswer is stored as a bare letter ("A") while options are "A) full text..."
const isOptionCorrect = (option: string, answer: string): boolean => {
  if (!option || !answer) return false;
  // Direct full-text match
  if (option.trim().toLowerCase() === answer.trim().toLowerCase()) return true;
  // answer is a bare letter: check option's leading letter
  const answerTrimmed = answer.trim().toUpperCase();
  if (/^[A-D]$/.test(answerTrimmed)) {
    const optionLetter = option.trim().toUpperCase().charAt(0);
    if (/^[A-D]$/.test(optionLetter)) {
      const separator = option.trim().charAt(1);
      if (separator === ')' || separator === '.' || separator === ':' || separator === ' ') {
        return optionLetter === answerTrimmed;
      }
    }
  }
  // answer is full text: strip leading "A) " prefix from both and compare body
  const stripPrefix = (s: string) => s.trim().replace(/^[A-D][).:\s]+/i, '').trim().toLowerCase();
  const optBody = stripPrefix(option);
  const ansBody = stripPrefix(answer);
  return optBody.length > 0 && optBody === ansBody;
};

const getCorrectOptionText = (options: string[], answer: string): string =>
  options.find(o => isOptionCorrect(o, answer)) ?? answer;

type QuizPhase = 'intro' | 'quiz' | 'results';
interface Answer { idx: number; selected: string; correct: boolean; }

const SharedQuiz: React.FC<{ questions: ShareableQuiz[]; title: string }> = ({ questions, title }) => {
  const [phase, setPhase] = useState<QuizPhase>('intro');
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'quiz') return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [phase, startTime]);

  const handleStart = () => { setPhase('quiz'); setStartTime(Date.now()); setCurrent(0); setAnswers([]); setSelected(null); };
  const handleReset = () => { setPhase('intro'); setCurrent(0); setAnswers([]); setSelected(null); setElapsed(0); };

  const handleNext = useCallback(() => {
    if (selected === null) return;
    const q = questions[current];
    const newAnswer: Answer = { idx: current, selected, correct: isOptionCorrect(selected, q.correctAnswer) };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setSelected(null);
    if (current + 1 >= questions.length) { setPhase('results'); setElapsed(Date.now() - startTime); }
    else setCurrent(i => i + 1);
  }, [selected, current, answers, questions, startTime]);

  const formatTime = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}m ${s % 60}s`; };
  const score = answers.filter(a => a.correct).length;
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <AnimatePresence mode="wait">
      {phase === 'intro' && (
        <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-8 text-center space-y-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <BookOpen size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-text-main">{title}</h3>
            <p className="text-text-muted mt-1">{questions.length} questions</p>
          </div>
          <button onClick={handleStart} className="w-full rounded-xl bg-primary py-3 text-sm font-black text-white hover:opacity-90 transition-opacity">
            Start Quiz
          </button>
        </motion.div>
      )}

      {phase === 'quiz' && (
        <motion.div key="quiz" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>{current + 1} / {questions.length}</span>
            <span className="flex items-center gap-1"><Clock size={13} />{formatTime(elapsed)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((current + 1) / questions.length) * 100}%` }} />
          </div>
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-5 space-y-4">
            <p className="text-sm font-bold text-text-main leading-relaxed">{questions[current].question}</p>
            <div className="space-y-2">
              {questions[current].options.map((opt, i) => {
                const isSelected = selected === opt;
                const isCorrect = selected !== null && isOptionCorrect(opt, questions[current].correctAnswer);
                const isWrong = selected !== null && isSelected && !isCorrect;
                return (
                  <button key={i} onClick={() => { if (selected === null) setSelected(opt); }}
                    className={cn(
                      'w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                      selected === null
                        ? 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-primary/50 hover:bg-primary/5'
                        : isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : isWrong ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] opacity-50',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {opt}
                      {isCorrect && <CheckCircle2 size={15} className="ml-auto text-emerald-500" />}
                      {isWrong && <XCircle size={15} className="ml-auto text-red-500" />}
                    </span>
                  </button>
                );
              })}
            </div>
            {selected !== null && questions[current].explanation && (
              <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 text-xs text-teal-700">
                <span className="font-bold">Explanation: </span>{questions[current].explanation}
              </div>
            )}
          </div>
          <button onClick={handleNext} disabled={selected === null}
            className="w-full rounded-xl bg-primary py-3 text-sm font-black text-white disabled:opacity-40 hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            {current + 1 >= questions.length ? 'Finish' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

      {phase === 'results' && (
        <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
          <div className={cn('rounded-2xl border p-6 text-center space-y-3',
            pct >= 80 ? 'border-emerald-200 bg-emerald-50' : pct >= 50 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
          )}>
            <Trophy size={36} className={cn('mx-auto', pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500')} />
            <p className={cn('text-4xl font-black', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>{pct}%</p>
            <p className="text-text-muted text-sm">{score} / {questions.length} correct · {formatTime(elapsed)}</p>
            <button onClick={handleReset} className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2 text-sm font-bold text-text-muted hover:border-primary/50 transition-all mx-auto">
              <RotateCcw size={13} /> Try Again
            </button>
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => {
              const ans = answers[i];
              return (
                <div key={i} className={cn('rounded-xl border p-4', ans?.correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50')}>
                  <div className="flex items-start gap-3">
                    {ans?.correct ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-main">{q.question}</p>
                      <p className="text-xs mt-1 text-text-muted">Your answer: <span className={ans?.correct ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{ans?.selected ?? '—'}</span></p>
                      {!ans?.correct && <p className="text-xs mt-0.5 text-text-muted">Correct: <span className="text-emerald-600 font-bold">{getCorrectOptionText(q.options, q.correctAnswer)}</span></p>}
                      {q.explanation && <p className="text-xs text-text-muted mt-1">{q.explanation}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Flashcard sub-component ──────────────────────────────────────────────────

const SharedFlashcards: React.FC<{ cards: ShareableCard[] }> = ({ cards }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const go = (delta: number) => { setIndex(i => (i + delta + cards.length) % cards.length); setFlipped(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-text-muted mb-2">
        <span>{index + 1} / {cards.length}</span>
        <span className="text-xs">Click card to flip</span>
      </div>
      <div
        onClick={() => setFlipped(f => !f)}
        className="cursor-pointer select-none"
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', minHeight: '160px' }}
        >
          {/* Front */}
          <div className="absolute inset-0 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] flex items-center justify-center p-6 text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-base font-bold text-text-main">{cards[index].front}</p>
          </div>
          {/* Back */}
          <div className="absolute inset-0 rounded-2xl border border-primary/30 bg-primary/5 flex items-center justify-center p-6 text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-sm text-text-main leading-relaxed">{cards[index].back}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 pt-2">
        <button onClick={() => go(-1)} className="rounded-xl border border-[var(--border-color)] p-2 text-text-muted hover:text-primary hover:border-primary/40 transition-all">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button key={i} onClick={() => { setIndex(i); setFlipped(false); }}
              className={cn('w-2 h-2 rounded-full transition-all', i === index ? 'bg-primary' : 'bg-zinc-200 hover:bg-zinc-300')}
            />
          ))}
        </div>
        <button onClick={() => go(1)} className="rounded-xl border border-[var(--border-color)] p-2 text-text-muted hover:text-primary hover:border-primary/40 transition-all">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Glossary renderer ───────────────────────────────────────────────────────

import { ShareableGlossaryTerm } from '../services/shareContentService';

const SharedGlossary: React.FC<{ terms: ShareableGlossaryTerm[] }> = ({ terms }) => {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map: Record<string, ShareableGlossaryTerm[]> = {};
    for (const t of terms) {
      const letter = t.term[0]?.toUpperCase() ?? '#';
      (map[letter] ??= []).push(t);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [terms]);

  const availableLetters = new Set(grouped.map(([l]) => l));

  const scrollToLetter = (letter: string) => {
    document.getElementById(`shared-glossary-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveLetter(letter);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Glossary</h2>
        <span className="text-xs text-text-muted">{terms.length} terms</span>
      </div>
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-6">
          {grouped.map(([letter, letterTerms]) => (
            <div key={letter} id={`shared-glossary-${letter}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl font-black text-primary">{letter}</span>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <span className="text-xs text-text-muted">{letterTerms.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {letterTerms.map((t, i) => (
                  <div key={i} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4 hover:border-primary/30 transition-all">
                    <h3 className="font-bold text-text-main leading-snug mb-2">{t.term}</h3>
                    <p className="text-sm text-text-muted leading-relaxed">{t.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* A-Z nav */}
        <div className="hidden sm:flex sticky top-6 self-start flex-col items-center gap-px">
          {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ#').map(letter => {
            const has = availableLetters.has(letter);
            const isActive = activeLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => has && scrollToLetter(letter)}
                disabled={!has}
                className={cn(
                  'w-6 h-6 rounded text-[11px] font-black flex items-center justify-center transition-all duration-150',
                  isActive
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : has
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-zinc-300 cursor-default',
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Document preview (no auth required) ─────────────────────────────────────

const SharedDocumentViewer: React.FC<{ token: string; fileType: string }> = ({ token, fileType }) => {
  const fileUrl = `${API_URL}/api/share/${token}/file`;
  const [collapsed, setCollapsed] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);

  const isPdf = fileType.includes('pdf');
  const isDocx = fileType.includes('wordprocessingml') || fileType.includes('docx');
  const isTxt = fileType.includes('text/plain');
  const isMd = fileType.includes('markdown');

  useEffect(() => {
    if (!measureRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isTxt || isMd) {
      fetch(fileUrl).then(r => r.text()).then(setTextContent).catch(() => setTextContent('Failed to load content.'));
    } else if (isDocx && docxRef.current) {
      fetch(fileUrl)
        .then(r => r.arrayBuffer())
        .then(buf => { if (docxRef.current) renderAsync(buf, docxRef.current); })
        .catch(() => { if (docxRef.current) docxRef.current.innerHTML = '<p class="text-red-500 p-4">Failed to load document.</p>'; });
    }
  }, [fileUrl, isTxt, isMd, isDocx]);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <FileText size={13} className="text-primary" />
        </div>
        <span className="text-xs font-semibold text-text-muted flex-1">Document Preview</span>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="rounded-lg p-1 text-text-muted hover:text-text-main hover:bg-[var(--bg-app)] transition-colors"
        >
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>

      {!collapsed && (
        <div ref={measureRef} className="max-h-[600px] overflow-y-auto bg-zinc-100 p-3">
          {isPdf && (
            <div className="flex flex-col items-center gap-3">
              <PdfDocument
                file={fileUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="flex flex-col items-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-zinc-500">Loading PDF...</p></div>}
                error={<div className="rounded-xl bg-red-50 p-6 text-center text-red-600 border border-red-100"><p className="font-semibold">Failed to load PDF</p></div>}
              >
                {numPages && Array.from({ length: numPages }, (_, i) => (
                  <PdfPage
                    key={i + 1}
                    pageNumber={i + 1}
                    width={containerWidth ? Math.max(containerWidth - 24, 200) : 300}
                    renderAnnotationLayer
                    renderTextLayer
                    className="mb-3 shadow-sm"
                  />
                ))}
              </PdfDocument>
            </div>
          )}

          {isDocx && (
            <>
              <style>{`.docx-wrapper{background:transparent!important;padding:0!important}.docx-wrapper>section.docx{margin-bottom:12px!important;box-shadow:0 1px 3px rgba(0,0,0,0.08)!important;max-width:100%!important;overflow-x:hidden!important}`}</style>
              <div ref={docxRef} className="mx-auto max-w-3xl overflow-x-hidden" />
            </>
          )}

          {(isTxt || isMd) && (
            <div className="mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-sm prose prose-sm prose-zinc">
              {isTxt ? (
                <pre className="whitespace-pre-wrap font-sans break-words text-sm">{textContent ?? ''}</pre>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent ?? ''}</ReactMarkdown>
              )}
            </div>
          )}

          {!isPdf && !isDocx && !isTxt && !isMd && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText size={32} className="text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-500">Preview not available for this file type.</p>
              <a
                href={fileUrl}
                download
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                Download File
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const SharedContentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [content, setContent] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [copied, setCopied] = useState(false);
  const [articleHtml, setArticleHtml] = useState<string | null>(null);
  const [articleCollapsed, setArticleCollapsed] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid share link.'); setLoading(false); return; }
    getShare(token)
      .then(data => {
        setContent(data);
        // Auto-select first available tab
        if (data.summary) setActiveTab('summary');
        else if (data.mindMapText) setActiveTab('mindmap');
        else if (data.notesHtml) setActiveTab('notes');
        else if (data.flashcards?.length) setActiveTab('flashcards');
        else if (data.glossary?.length) setActiveTab('glossary');
        else if (data.quizzes?.length) setActiveTab('quiz');
        if (data.sourceType === 'article' && data.sourceUrl) {
          fetch(`${API_URL}/api/share/${token}/article`)
            .then(r => r.ok ? r.text() : null)
            .then(html => { if (html) setArticleHtml(html); })
            .catch(() => { });
        }
      })
      .catch((err: any) => {
        if (err?.response?.status === 410) setError('This share link has expired.');
        else setError('This shared content could not be found or has expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="text-center space-y-4 max-w-sm mx-auto px-4">
          <div className="rounded-2xl bg-red-50 p-5 text-red-500 w-fit mx-auto"><AlertCircle size={32} /></div>
          <h1 className="text-xl font-bold text-text-main">Content Not Found</h1>
          <p className="text-text-muted">{error}</p>
          <Link to="/" className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Go to Study Platform
          </Link>
        </div>
      </div>
    );
  }

  const allTabs = [
    { id: 'summary' as Tab, label: 'Summary', icon: FileText, available: !!content.summary },
    { id: 'mindmap' as Tab, label: 'Mind Map', icon: Map, available: !!content.mindMapText },
    { id: 'notes' as Tab, label: 'Notes', icon: MessageSquare, available: !!content.notesHtml },
    { id: 'flashcards' as Tab, label: 'Flashcards', icon: BrainCircuit, available: !!(content.flashcards?.length) },
    { id: 'glossary' as Tab, label: 'Glossary', icon: BookMarked, available: !!(content.glossary?.length) },
    { id: 'quiz' as Tab, label: 'Quiz', icon: BookOpen, available: !!(content.quizzes?.length) },
  ];
  const tabs = allTabs.filter(t => t.available);

  const createdAt = new Date(content.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Share2 size={11} /> Shared Study Content
                </div>
                {content.sourceType === 'youtube' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-500 border border-red-100">
                    <Youtube size={11} /> YouTube Video
                  </div>
                )}
                {content.sourceType === 'audio' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-100">
                    <Mic size={11} /> Audio
                  </div>
                )}
                {content.sourceType === 'podcast' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-100">
                    <Rss size={11} /> Podcast
                  </div>
                )}
                {content.sourceType === 'article' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-600 border border-teal-100">
                    <FileText size={11} /> Article
                  </div>
                )}
                {content.sourceType === 'document' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500 border border-zinc-200">
                    <FileText size={11} /> Document
                  </div>
                )}
              </div>
              <h1 className="text-xl font-black text-text-main leading-tight">{content.title}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <User size={12} /> {content.ownerName}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Calendar size={12} /> {createdAt}
                </span>
                {content.expiresAt && (
                  <span className="text-xs text-amber-500 font-medium">
                    Expires {new Date(content.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border transition-all shrink-0',
                copied ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-[var(--border-color)] text-text-muted hover:border-primary/50',
              )}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Media */}
        {content.sourceType === 'youtube' && content.sourceUrl && (() => {
          const videoId = content.sourceUrl.match(
            /(?:[?&]v=|youtu\.be\/|shorts\/|embed\/)([^&?/\s]{11})/
          )?.[1];
          return videoId ? (
            <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-black">
              <a
                href={content.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] hover:bg-primary/5 transition-colors group"
              >
                <div className="w-6 h-6 rounded-md bg-red-500 flex items-center justify-center shrink-0">
                  <Youtube size={13} className="text-white" />
                </div>
                <span className="flex-1 min-w-0 text-xs text-text-muted truncate">{content.sourceUrl}</span>
                <ExternalLink size={13} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
              </a>
              <div style={{ aspectRatio: '16/9' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                  title={content.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          ) : null;
        })()}

        {content.sourceType === 'audio' && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Mic size={13} className="text-primary" />
              </div>
              <span className="text-xs font-semibold text-text-muted truncate">{content.title}</span>
            </div>
            <div className="px-4 py-4">
              <audio
                controls
                className="w-full"
                src={`${API_URL}/api/share/${content.token}/audio`}
              />
            </div>
          </div>
        )}

        {content.sourceType === 'podcast' && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
              <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                <Rss size={13} className="text-amber-500" />
              </div>
              <span className="text-xs font-semibold text-text-muted truncate flex-1">{content.title}</span>
            </div>
            {content.originalArticleUrl && (
              <a
                href={content.originalArticleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] hover:bg-amber-50 transition-colors group"
              >
                <Rss size={14} className="text-amber-500 shrink-0" />
                <span className="flex-1 min-w-0 text-xs text-text-muted truncate group-hover:text-amber-600 transition-colors">
                  Listen on Apple Podcasts
                </span>
                <ExternalLink size={12} className="text-text-muted group-hover:text-amber-500 transition-colors shrink-0" />
              </a>
            )}
            <div className="px-4 py-4">
              <audio
                controls
                className="w-full"
                src={`${API_URL}/api/share/${content.token}/audio`}
              />
            </div>
          </div>
        )}

        {content.sourceType === 'document' && content.fileType && (
          <SharedDocumentViewer token={content.token} fileType={content.fileType} />
        )}

        {content.sourceType === 'article' && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <FileText size={13} className="text-primary" />
              </div>
              <span className="text-xs font-semibold text-text-muted flex-1">Original Article</span>
              <button
                onClick={() => setArticleCollapsed(c => !c)}
                className="rounded-lg p-1 text-text-muted hover:text-text-main hover:bg-[var(--bg-app)] transition-colors"
              >
                {articleCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </button>
            </div>
            {/* Original URL link bar */}
            {content.originalArticleUrl && (
              <a
                href={content.originalArticleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] hover:bg-primary/5 transition-colors group"
              >
                <ExternalLink size={14} className="text-primary shrink-0" />
                <span className="flex-1 min-w-0 text-xs text-text-muted truncate group-hover:text-primary transition-colors">
                  {content.originalArticleUrl}
                </span>
                <ExternalLink size={12} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
              </a>
            )}
            {/* Content */}
            {!articleCollapsed && (
              articleHtml ? (
                <div className="prose prose-sm max-w-none p-6 text-text-main overflow-auto max-h-[600px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{articleHtml}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              )
            )}
          </div>
        )}

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap transition-all border',
                  activeTab === id
                    ? 'bg-primary text-white border-primary'
                    : 'border-[var(--border-color)] text-text-muted hover:border-primary/50 hover:text-text-main',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab ?? 'empty'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {activeTab === 'summary' && content.summary && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Summary</h2>
                <div className="prose prose-sm max-w-none text-text-main">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.summary}</ReactMarkdown>
                </div>
              </div>
            )}

            {activeTab === 'mindmap' && content.mindMapText && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4 px-2">Mind Map</h2>
                <MarkmapView text={content.mindMapText} />
              </div>
            )}

            {activeTab === 'notes' && content.notesHtml && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Notes</h2>
                <div
                  className="prose prose-sm max-w-none text-text-main"
                  dangerouslySetInnerHTML={{ __html: content.notesHtml }}
                />
              </div>
            )}

            {activeTab === 'flashcards' && content.flashcards && content.flashcards.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Flashcards</h2>
                <SharedFlashcards cards={content.flashcards} />
              </div>
            )}

            {activeTab === 'glossary' && content.glossary && content.glossary.length > 0 && (
              <SharedGlossary terms={content.glossary} />
            )}

            {activeTab === 'quiz' && content.quizzes && content.quizzes.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Quiz</h2>
                <SharedQuiz questions={content.quizzes} title={content.title} />
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6 text-center">
          <Award size={22} className="mx-auto text-primary mb-3" />
          <p className="font-bold text-text-main mb-1">Want to create your own study materials?</p>
          <p className="text-sm text-text-muted mb-4">Upload documents or YouTube videos and get AI-generated summaries, mind maps, quizzes and flashcards.</p>
          <Link to="/" className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Try Easy Study →
          </Link>
        </div>

      </div>
    </div>
  );
};

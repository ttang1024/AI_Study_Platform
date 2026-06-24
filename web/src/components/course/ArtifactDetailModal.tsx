import React from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { ArtifactContent } from './ArtifactContent';
import { MindMapViewer } from '../mindmap/MindMapViewer';
import { ChatPanel } from '../ai/ChatPanel';
import type { OpenArtifactDetail, ExternalMsg } from './CourseArtifactsWorkspace';

interface ArtifactDetailModalProps {
  detail: OpenArtifactDetail;
  isMindmapOrChat: boolean;
  detailCount: number;
  detailPosition: number;
  revealAnswers: boolean;
  mmText: string | null;
  mmGenerating: boolean;
  mmStreaming: string | null;
  mmError: string | null;
  chatLoading: boolean;
  chatMessages: ExternalMsg[];
  togglingGlossaryId: string | null;
  masteredIds: Set<string>;
  togglingProblemId: string | null;
  masteredProblemIds: Set<string>;
  onClose: () => void;
  onSwitch: (direction: -1 | 1) => void;
  onToggleReveal: () => void;
  onGenerateMindMap: () => Promise<void>;
  onChatStreamSend: (message: string, onChunk: (chunk: string) => void) => Promise<void>;
  onToggleMastered: (termId: string) => void;
  onToggleProblemMastered: (problemId: string) => void;
}

export const ArtifactDetailModal: React.FC<ArtifactDetailModalProps> = ({
  detail,
  isMindmapOrChat,
  detailCount,
  detailPosition,
  revealAnswers,
  mmText,
  mmGenerating,
  mmStreaming,
  mmError,
  chatLoading,
  chatMessages,
  togglingGlossaryId,
  masteredIds,
  togglingProblemId,
  masteredProblemIds,
  onClose,
  onSwitch,
  onToggleReveal,
  onGenerateMindMap,
  onChatStreamSend,
  onToggleMastered,
  onToggleProblemMastered,
}) => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className={cn(
            'flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl',
            isMindmapOrChat
              ? 'w-full max-w-4xl h-[88vh]'
              : 'w-full max-w-2xl max-h-[86vh]',
          )}>

            {/* Modal header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-color)] bg-white p-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{detail.type}</p>
                <h2 className="mt-1 text-lg font-bold text-text-main truncate">{detail.title}</h2>
              </div>
              <button onClick={() => onClose()} className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className={cn('min-h-0 flex-1 overflow-hidden', !isMindmapOrChat && 'overflow-y-auto p-5 space-y-4 text-sm text-text-main')}>

              {/* Standard artifact types */}
              {detail.type === 'summary' && <div className="p-5"><ArtifactContent value={detail.content} /></div>}
              {detail.type === 'note' && <div className="p-5"><ArtifactContent value={detail.content} /></div>}
              {detail.type === 'flashcard' && (
                <div className="p-5 space-y-4">
                  <div className="rounded-xl bg-[var(--bg-app)] p-4">
                    <p className="text-xs font-bold text-text-muted">Front</p>
                    <ArtifactContent value={detail.front} className="mt-2" />
                  </div>
                  <div className="rounded-xl bg-primary/5 p-4">
                    <p className="text-xs font-bold text-primary">Back</p>
                    <ArtifactContent value={detail.back} className="mt-2" />
                  </div>
                </div>
              )}
              {detail.type === 'question' && (
                <div className="p-5 space-y-4 text-sm text-text-main">
                  <ArtifactContent value={detail.question.question} />

                  {revealAnswers ? (
                    /* ── Reveal mode: highlight correct / wrong options ── */
                    <>
                      <div className="space-y-2">
                        {detail.question.options.map((option, index) => {
                          const isCorrect = isQuizOptionCorrect(option, detail.question.correctAnswer);
                          const isWrongPick = !!detail.userAnswer
                            && isQuizOptionCorrect(option, detail.userAnswer)
                            && !isCorrect;
                          return (
                            <div
                              key={index}
                              className={cn(
                                'flex items-start gap-2.5 rounded-xl px-3 py-2.5',
                                isCorrect
                                  ? 'border border-emerald-300 bg-emerald-50'
                                  : isWrongPick
                                    ? 'border border-red-300 bg-red-50'
                                    : 'bg-[var(--bg-app)]',
                              )}
                            >
                              {isCorrect && (
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                              )}
                              {isWrongPick && (
                                <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                              )}
                              {!isCorrect && !isWrongPick && (
                                <span className="mt-0.5 h-4 w-4 shrink-0" />
                              )}
                              <ArtifactContent value={option} />
                            </div>
                          );
                        })}
                      </div>
                      {detail.question.explanation && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-amber-600">Analysis</p>
                          <ArtifactContent value={detail.question.explanation} className="text-amber-900" />
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── Standard mode: plain options only ── */
                    <div className="space-y-2">
                      {detail.question.options.map((option, index) => (
                        <div key={index} className="rounded-xl bg-[var(--bg-app)] px-3 py-2">
                          <ArtifactContent value={option} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {detail.type === 'glossary' && (
                <div className="p-5 text-sm text-text-main">
                  <p className="text-xl font-bold">{detail.term.term}</p>
                  <ArtifactContent value={detail.term.definition} className="mt-2 text-text-muted" />
                </div>
              )}
              {detail.type === 'problem' && (
                <div className="p-5 space-y-4 text-sm text-text-main">
                  <ArtifactContent value={detail.problem.problemText} />
                  <div className="space-y-2">
                    {detail.problem.steps.map(step => (
                      <div key={step.stepNumber} className="rounded-xl bg-[var(--bg-app)] p-3">
                        <p className="font-semibold">Step {step.stepNumber}</p>
                        <ArtifactContent value={step.description} className="mt-1 text-text-muted" />
                        {step.formula && <ArtifactContent value={`$$${step.formula}$$`} className="mt-2 text-primary" />}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-bold text-primary">Final answer</p>
                    <ArtifactContent value={detail.problem.finalAnswer} className="mt-1" />
                  </div>
                </div>
              )}

              {/* Mind Map */}
              {detail.type === 'mindmap' && (
                <div className="h-full p-4">
                  <MindMapViewer
                    mindMapText={mmText}
                    onGenerate={onGenerateMindMap}
                    isGenerating={mmGenerating}
                    streamingText={mmStreaming}
                    title={detail.title}
                    externalError={mmError}
                  />
                </div>
              )}

              {/* AI Chat */}
              {detail.type === 'chat' && (
                chatLoading ? (
                  <div className="flex items-center justify-center h-full gap-2 text-text-muted">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Loading conversation…</span>
                  </div>
                ) : (
                  <ChatPanel
                    key={detail.itemKey}
                    externalMessages={chatMessages}
                    onExternalStreamSend={onChatStreamSend}
                    placeholder={`Ask about "${detail.title}"…`}
                    hideHeader
                    hideAddToNotes
                  />
                )
              )}
            </div>

            {/* Modal footer — nav for standard artifacts only */}
            {!isMindmapOrChat && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-color)] bg-white p-4">
                <button
                  type="button"
                  onClick={() => onSwitch(-1)}
                  disabled={detailCount <= 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                {detail?.type === 'glossary' ? (
                  <button
                    type="button"
                    onClick={() => onToggleMastered(detail.term.id)}
                    disabled={togglingGlossaryId === detail.term.id}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      masteredIds.has(detail.term.id)
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'border-[var(--border-color)] text-text-muted hover:border-emerald-400 hover:text-emerald-600',
                    )}
                  >
                    <CheckCircle2 size={15} />
                    {masteredIds.has(detail.term.id) ? 'Mastered' : 'Mark as mastered'}
                  </button>
                ) : detail?.type === 'problem' ? (
                  <button
                    type="button"
                    onClick={() => onToggleProblemMastered(detail.problem.workedProblemId)}
                    disabled={togglingProblemId === detail.problem.workedProblemId}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      masteredProblemIds.has(detail.problem.workedProblemId)
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'border-[var(--border-color)] text-text-muted hover:border-emerald-400 hover:text-emerald-600',
                    )}
                  >
                    <CheckCircle2 size={15} />
                    {masteredProblemIds.has(detail.problem.workedProblemId) ? 'Mastered' : 'Mark as mastered'}
                  </button>
                ) : detail?.type === 'question' ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleReveal()}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors',
                        revealAnswers
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-[var(--border-color)] text-text-muted hover:border-primary hover:text-primary',
                      )}
                      title={revealAnswers ? 'Hide answer' : 'Reveal answer'}
                    >
                      <Eye size={15} />
                      {revealAnswers ? 'Hide' : 'Reveal'}
                    </button>
                    <span className="text-xs font-bold text-text-muted">{detailPosition} of {detailCount}</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-text-muted">{detailPosition} of {detailCount}</span>
                )}
                <button
                  type="button"
                  onClick={() => onSwitch(1)}
                  disabled={detailCount <= 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
);

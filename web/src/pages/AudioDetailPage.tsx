import React from 'react';
import { motion } from 'motion/react';
import {
  Mic, Rss, Sparkles, Loader2, ChevronLeft, AlertCircle, FileText, Copy, Download, RotateCcw, Share2,
} from 'lucide-react';
import { ShareModal } from '../components/common/ShareModal';
import { DetailPageSkeleton } from '../components/common/DetailPageSkeleton';
import { ShareableQuiz, ShareableCard } from '../services/shareContentService';
import { documentService } from '../services/documentService';
import { VideoNoteEditor } from '../components/youtube/VideoNoteEditor';
import { MindMapViewer } from '../components/mindmap/MindMapViewer';
import { Flashcards } from '../components/study/Flashcards';
import { DocumentQuiz } from '../components/quiz/DocumentQuiz';
import { ChatPanel } from '../components/ai/ChatPanel';
import { ChatConversationBar } from '../components/ai/ChatConversationBar';
import { SummaryPanel } from '../components/study/SummaryPanel';
import { WorkedProblemsPanel } from '../components/WorkedProblemsPanel';
import { cn } from '../utils/cn';
import { TABS } from '../constants/tab';
import { SegmentedTranscript } from './audioDetail/SegmentedTranscript';
import { useAudioDetail } from './audioDetail/useAudioDetail';

export const AudioDetailPage: React.FC<{ embedded?: boolean; id?: string; courseId?: string }> = ({ embedded, id: propId, courseId: propCourseId }) => {
  const a = useAudioDetail(propId, propCourseId);
  const {
    id, courseId, navigate, fileName, isPodcast, podcastOriginalUrl, audioUrl, isLoadingPage,
    audioRef, activeSegmentRef, currentTime, setCurrentTime,
    transcript, isTranscribing, transcriptError, handleTranscribe, seekAudioTo,
    openMenu, setOpenMenu, copyMenuRef, downloadMenuRef, copyTranscript, downloadTranscript,
    activeTab, setActiveTab, activeView, setActiveView, targetQuizQuestionId,
    summary, isLoadingSummary, summaryStreamText, summaryError, generateSummary, handleSaveSummary,
    mindMapText, isLoadingMindMap, mindMapStreamingText, mindMapError, generateMindMap, handleSaveMindMap,
    showShareModal, setShowShareModal, noteContent, noteEditorRef, handleNoteSave,
    flashcards, isLoadingFlashcards, flashcardsError, generateFlashcards,
    activeQuizDifficulty, quizQuestionSets, quizQuestions, userAnswers, isQuizSubmitted,
    quizScore, isLoadingQuiz, quizError, generateQuiz, handleQuizDifficultyChange, submitQuiz, onAnswerQuiz,
    chatMessages, chatPanelRef, streamChat,
    chatConversations, activeConversationId, selectConversation, newConversation, deleteConversation,
    generationDisabled, generationDisabledReason, hasGeneratedQuizzes,
  } = a;

  // ─── Study Panel ───────────────────────────────────────────────────────────

  const studyPanel =
    <div className="flex flex-col h-full w-full">
      {/* Horizontal Tab Bar */}
      <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0',
              activeTab === tab.id
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-text-muted hover:text-text-main',
            )}
          >
            <tab.icon size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-sidebar)]">

        <div className={cn('flex-1 overflow-y-auto no-scrollbar', activeTab === 'chat' && 'hidden')}>
          <div className={cn('h-full', activeTab !== 'summary' && 'hidden')}>
            <SummaryPanel
              summary={summary}
              isLoading={isLoadingSummary}
              onGenerate={generateSummary}
              loadingText={isPodcast ? 'AI is analyzing the podcast…' : 'AI is analyzing the audio…'}
              emptyText={isPodcast ? 'Generate an AI summary of this episode.' : 'Generate an AI summary of this lecture.'}
              error={summaryError}
              onRetry={generateSummary}
              streamingText={summaryStreamText}
              onTimelineSeek={seekAudioTo}
              generateDisabled={generationDisabled}
              generateDisabledReason={generationDisabledReason}
              onSaveSummary={handleSaveSummary}
            />
          </div>

          <div className={cn('h-full', activeTab !== 'mindmap' && 'hidden')}>
            <MindMapViewer
              mindMapText={mindMapText}
              onGenerate={generateMindMap}
              isGenerating={isLoadingMindMap}
              streamingText={mindMapStreamingText}
              externalError={mindMapError}
              title={fileName ?? 'mindmap'}
              generateDisabled={generationDisabled}
              generateDisabledReason={generationDisabledReason}
              onSaveEdit={handleSaveMindMap}
            />
          </div>

          <div className={cn('h-full relative', activeTab !== 'notes' && 'hidden')}>
            {id ? (
              <VideoNoteEditor
                ref={noteEditorRef}
                videoRecordId={id}
                initialContent={noteContent}
                onSave={handleNoteSave}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                Load an audio file to start taking notes.
              </div>
            )}
          </div>

          <div className={cn('h-full', activeTab !== 'flashcards' && 'hidden')}>
            <Flashcards
              externalCards={flashcards}
              onExternalGenerate={generateFlashcards}
              isExternalGenerating={isLoadingFlashcards}
              externalError={flashcardsError}
              generateDisabled={generationDisabled}
              generateDisabledReason={generationDisabledReason}
            />
          </div>

          <div className={cn('h-full overflow-y-auto', activeTab !== 'quiz' && 'hidden')}>
            <DocumentQuiz
              activeDifficulty={activeQuizDifficulty}
              targetQuestionId={targetQuizQuestionId}
              externalQuestions={quizQuestions}
              externalQuestionCounts={{
                easy: quizQuestionSets.easy.length,
                medium: quizQuestionSets.medium.length,
                hard: quizQuestionSets.hard.length,
              }}
              externalUserAnswers={userAnswers}
              externalSubmitted={isQuizSubmitted}
              externalScore={quizScore}
              isExternalLoading={isLoadingQuiz}
              externalError={quizError}
              onExternalGenerate={generateQuiz}
              onExternalDifficultyChange={handleQuizDifficultyChange}
              generateDisabled={generationDisabled}
              generateDisabledReason={generationDisabledReason}
              onExternalAnswer={onAnswerQuiz}
              onExternalSubmit={submitQuiz}
            />
          </div>

          <div className={cn('h-full overflow-y-auto', activeTab !== 'problems' && 'hidden')}>
            {id && activeTab === 'problems' && (
              <WorkedProblemsPanel documentId={id} generateDisabled={generationDisabled} generateDisabledReason={generationDisabledReason} />
            )}
          </div>
        </div>

        <div className={cn('flex-1 overflow-hidden flex flex-col', activeTab !== 'chat' && 'hidden')}>
          <ChatConversationBar
            conversations={chatConversations}
            activeId={activeConversationId}
            onSelect={selectConversation}
            onNew={newConversation}
            onDelete={deleteConversation}
          />
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              ref={chatPanelRef}
              externalMessages={chatMessages}
              onExternalStreamSend={streamChat}
              enableAttachments
              onExternalAddToNote={(html) => {
                noteEditorRef.current?.appendContent(html);
                setActiveTab('notes');
              }}
              placeholder="Ask anything about the lecture…"
            />
          </div>
        </div>
      </div>
    </div>


  if (isLoadingPage) {
    return <DetailPageSkeleton variant="audio" embedded={embedded} />;
  }

  return (
    <div className={cn("flex flex-col bg-[var(--bg-app)] overflow-hidden", embedded ? "h-full" : "h-screen")}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Header */}
        {!embedded && (
          <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0', isPodcast ? 'bg-amber-500' : 'bg-[var(--primary)]')}>
              {isPodcast ? <Rss size={14} /> : <Mic size={14} />}
            </div>
            <p className="flex-1 min-w-0 text-xs font-medium text-text-main truncate">
              {fileName ?? (isPodcast ? 'Podcast Episode' : 'Audio Lecture')}
            </p>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted border border-[var(--border-color)] hover:border-primary/50 hover:text-primary transition-all shrink-0"
            >
              <Share2 size={13} /> Share
            </button>
          </div>
        )}

        {/* 3-panel layout */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left – Audio Player + Transcript */}
          <div className={cn(
            'flex-1 flex flex-col overflow-hidden transition-opacity duration-300',
            activeView === 'audio' ? 'opacity-100' : 'opacity-0 lg:opacity-100',
          )}>
            {/* Audio Player */}
            <div className="shrink-0 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl shrink-0', isPodcast ? 'bg-amber-100 text-amber-500' : 'bg-[var(--primary)]/10 text-[var(--primary)]')}>
                  {isPodcast ? <Rss size={24} /> : <Mic size={24} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-main truncate">{fileName ?? (isPodcast ? 'Podcast Episode' : 'Audio Lecture')}</p>
                  <p className="text-xs text-text-muted mt-0.5">{isPodcast ? 'Podcast Episode' : 'Audio Lecture'}</p>
                </div>
              </div>
              {audioUrl ? (
                <audio
                  ref={audioRef}
                  controls
                  src={audioUrl}
                  className="w-full h-10 rounded-xl"
                  style={{ accentColor: 'var(--primary)' }}
                  onTimeUpdate={e => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                >
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="flex items-center justify-center h-10 rounded-xl bg-zinc-100 text-xs text-text-muted">
                  <Loader2 size={14} className="animate-spin mr-2" /> Loading audio…
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center justify-between px-5 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-sidebar)]">
                <div className="flex items-center gap-1">
                  <span className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] border-b-2 border-[var(--primary)] text-[var(--primary)]">
                    Transcript
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {transcript && (
                    <>
                      {/* Copy dropdown */}
                      <div className="relative" ref={copyMenuRef}>
                        <button
                          onClick={() => setOpenMenu(openMenu === 'copy' ? null : 'copy')}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors"
                        >
                          <Copy size={11} /> Copy
                        </button>
                        {openMenu === 'copy' && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-lg border border-[var(--border-color)] bg-white shadow-lg overflow-hidden">
                            <button onClick={() => copyTranscript(true)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              Copy with timestamp
                            </button>
                            <button onClick={() => copyTranscript(false)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              Copy without timestamp
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Download dropdown */}
                      <div className="relative" ref={downloadMenuRef}>
                        <button
                          onClick={() => setOpenMenu(openMenu === 'download' ? null : 'download')}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors"
                        >
                          <Download size={11} /> Download
                        </button>
                        {openMenu === 'download' && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-lg border border-[var(--border-color)] bg-white shadow-lg overflow-hidden">
                            <button onClick={() => downloadTranscript('txt', true)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              TXT with timestamps
                            </button>
                            <button onClick={() => downloadTranscript('txt', false)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              TXT without timestamps
                            </button>
                            <button onClick={() => downloadTranscript('srt', true)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              SRT with timestamps
                            </button>
                            <button onClick={() => downloadTranscript('srt', false)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              SRT without timestamps
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Refresh */}
                      <button onClick={handleTranscribe} disabled={isTranscribing} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
                        <RotateCcw size={11} className={isTranscribing ? 'animate-spin' : ''} /> Refresh
                      </button>
                    </>
                  )}
                  {!transcript && transcriptError && (
                    <button onClick={handleTranscribe} disabled={isTranscribing} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
                      <RotateCcw size={11} className={isTranscribing ? 'animate-spin' : ''} /> Retry
                    </button>
                  )}
                </div>
              </div>

              {/* Transcript content */}
              <div className="flex-1 overflow-y-auto">
                {isTranscribing ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
                    <p className="text-xs text-zinc-400">{isPodcast ? 'Transcribing podcast…' : 'Transcribing audio…'}</p>
                    <p className="text-[11px] text-zinc-300">This may take a moment for longer recordings.</p>
                  </div>
                ) : transcript ? (
                  <SegmentedTranscript
                    transcript={transcript}
                    currentTime={currentTime}
                    activeSegmentRef={activeSegmentRef}
                    onSeek={t => { if (audioRef.current) { audioRef.current.currentTime = t; audioRef.current.play(); } }}
                  />
                ) : transcriptError ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-main">Transcription failed</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{transcriptError}</p>
                    </div>
                    <button
                      onClick={handleTranscribe}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
                    >
                      <RotateCcw size={11} /> Try Again
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-main">No transcript yet</p>
                      <p className="mt-1 text-[11px] text-zinc-400">Start transcription when you are ready.</p>
                    </div>
                    <button
                      onClick={handleTranscribe}
                      disabled={isTranscribing}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold bg-[var(--primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <FileText size={11} /> Transcribe
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right – Study Tools */}
          <div className={cn(
            'absolute inset-0 z-20 bg-[var(--bg-app)] lg:relative lg:flex lg:flex-1 lg:border-l lg:border-[var(--border-color)] lg:bg-[var(--bg-sidebar)] transition-transform duration-300 lg:translate-x-0',
            activeView === 'study' ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
          )}>
            {studyPanel}
          </div>

        </div>

        {/* Mobile Bottom Nav */}
        <div className="flex h-16 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:hidden shrink-0">
          <button onClick={() => setActiveView('study')} className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'study' ? 'text-[var(--primary)]' : 'text-text-muted')}>
            <Sparkles size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">Study</span>
          </button>
          <button onClick={() => setActiveView('audio')} className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'audio' ? 'text-[var(--primary)]' : 'text-text-muted')}>
            {isPodcast ? <Rss size={20} /> : <Mic size={20} />}
            <span className="text-[10px] font-bold uppercase tracking-wider">{isPodcast ? 'Podcast' : 'Audio'}</span>
          </button>
        </div>
      </motion.div>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={fileName ?? 'Audio Lecture'}
        summary={summary}
        mindMapText={mindMapText}
        notesHtml={noteContent || null}
        sourceType={isPodcast ? 'podcast' : 'audio'}
        sourceUrl={courseId && id ? `${courseId}/${id}` : null}
        originalArticleUrl={isPodcast ? podcastOriginalUrl : null}
        fetchQuizzes={courseId && id && hasGeneratedQuizzes ? async () => {
          const qs = await documentService.getQuiz(courseId, id);
          return qs.map(q => ({
            question: q.question,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? '',
            difficulty: q.difficulty ?? 'medium',
          } satisfies ShareableQuiz));
        } : undefined}
        fetchFlashcards={flashcards.length > 0 ? async () =>
          flashcards.map(c => ({ front: c.front, back: c.back, cardType: c.cardType } satisfies ShareableCard))
          : undefined}
      />
    </div>
  );
};

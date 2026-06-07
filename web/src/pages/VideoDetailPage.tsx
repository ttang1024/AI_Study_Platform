import React from 'react';
import { motion } from 'motion/react';
import { Youtube, Sparkles, Loader2, RotateCcw, ChevronLeft, AlertCircle, Copy, Download, Share2, FileVideo } from 'lucide-react';
import { VideoNoteEditor } from '../components/youtube/VideoNoteEditor';
import { MindMapViewer } from '../components/mindmap/MindMapViewer';
import { Flashcards } from '../components/study/Flashcards';
import { DocumentQuiz } from '../components/quiz/DocumentQuiz';
import { ChatPanel } from '../components/ai/ChatPanel';
import { SummaryPanel } from '../components/study/SummaryPanel';
import { WorkedProblemsPanel } from '../components/WorkedProblemsPanel';
import { TextSelectionToolbar } from '../components/document/TextSelectionToolbar';
import { cn } from '../utils/cn';
import { TABS } from '../constants/tab';
import { ShareModal } from '../components/common/ShareModal';
import { DetailPageSkeleton } from '../components/common/DetailPageSkeleton';
import { ShareableQuiz, ShareableCard } from '../services/shareContentService';
import { videoService } from '../services/videoService';
import { buildBilibiliPlayerUrl } from './videoDetail/helpers';
import { useVideoDetail } from './videoDetail/useVideoDetail';

export const VideoDetailPage: React.FC<{ embedded?: boolean; id?: string }> = ({ embedded, id: propId }) => {
  const v = useVideoDetail(propId);
  const {
    id, videoUrl, playbackUrl, videoTitle, sourceType, bilibiliVideo, videoId,
    bilibiliStartSeconds, bilibiliSeekNonce, isLoadingVideo, handleBack,
    activeTab, setActiveTab, activeView, setActiveView, locationState,
    summaryError, mindMapError, flashcardsError, quizError,
    noteContent, showShareModal, setShowShareModal,
    summary, isLoadingSummary, summaryStreamText, generateSummary,
    summaryRef, summaryToolbar, setSummaryToolbar,
    transcriptRef, transcriptToolbar, setTranscriptToolbar,
    centerView, setCenterView, loadSubtitlesOnDemand,
    transcript, transcriptError, isLoadingTranscript, refreshTranscript,
    subtitles, subtitlesError, isLoadingSubtitles, refreshSubtitles,
    iframeRef, uploadedVideoRef,
    openMenu, setOpenMenu, copyMenuRef, downloadMenuRef, copyTranscript, downloadTranscript,
    mindMapText, isLoadingMindMap, mindMapStreamingText, generateMindMap,
    flashcards, isLoadingFlashcards, generateFlashcards,
    activeQuizDifficulty, quizQuestionSets, quizQuestions, userAnswers, isQuizSubmitted,
    quizScore, isLoadingQuiz, generateQuiz, handleQuizDifficultyChange, submitQuiz, onAnswerQuiz,
    chatMessages, chatPanelRef, streamChat,
    noteEditorRef, handleNoteSave, seekTo,
    generationDisabled, generationDisabledReason, hasGeneratedQuizzes,
    handleSummaryMouseUp, handleTranscriptMouseUp,
  } = v;

  // ─── Study Panel ─────────────────────────────────────────────────────────
  const studyPanel = (
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
          {/* Summary */}
          <div className={cn('h-full', activeTab !== 'summary' && 'hidden')}>
            <SummaryPanel
              summary={summary}
              isLoading={isLoadingSummary}
              onGenerate={generateSummary}
              loadingText="AI is analyzing the video…"
              emptyText="Generate an AI summary of this video."
              error={summaryError}
              onRetry={generateSummary}
              streamingText={summaryStreamText}
              summaryRef={summaryRef}
              onMouseUp={handleSummaryMouseUp}
              onTimelineSeek={seekTo}
              generateDisabled={generationDisabled}
              generateDisabledReason={generationDisabledReason}
            />
          </div>

          {/* Mind Map */}
          <div className={cn('h-full', activeTab !== 'mindmap' && 'hidden')}>
            <MindMapViewer
              mindMapText={mindMapText}
              onGenerate={generateMindMap}
              isGenerating={isLoadingMindMap}
              streamingText={mindMapStreamingText}
              externalError={mindMapError}
              title={videoId ?? 'mindmap'}
              generateDisabled={generationDisabled}
              generateDisabledReason={generationDisabledReason}
            />
          </div>

          {/* Notes */}
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
                Load a video to start taking notes.
              </div>
            )}
          </div>

          {/* Flashcards */}
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

          {/* Quiz */}
          <div className={cn('h-full overflow-y-auto', activeTab !== 'quiz' && 'hidden')}>
            <DocumentQuiz
              activeDifficulty={activeQuizDifficulty}
              targetQuestionId={locationState?.targetQuizQuestionId}
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

          {/* Problems */}
          <div className={cn('h-full overflow-y-auto', activeTab !== 'problems' && 'hidden')}>
            {id && activeTab === 'problems' && (
              <WorkedProblemsPanel videoId={id} generateDisabled={generationDisabled} generateDisabledReason={generationDisabledReason} />
            )}
          </div>
        </div>

        {/* AI Chat */}
        <div className={cn('flex-1 overflow-hidden', activeTab !== 'chat' && 'hidden')}>
          <ChatPanel
            ref={chatPanelRef}
            externalMessages={chatMessages}
            onExternalStreamSend={streamChat}
            onExternalAddToNote={(html) => {
              noteEditorRef.current?.appendContent(html);
              setActiveTab('notes');
            }}
            placeholder="Ask anything about the video…"
          />
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════

  if (isLoadingVideo) {
    return <DetailPageSkeleton variant="youtube" embedded={embedded} />;
  }

  return (
    <div className={cn("flex flex-col bg-[var(--bg-app)] overflow-hidden", embedded ? "h-full" : "h-screen")}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Compact header */}
        {!embedded && (
          <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0', sourceType === 'bilibili' ? 'bg-sky-500' : 'bg-red-500')}>
              {sourceType === 'bilibili' ? (
                <img src="/images/bilibili-white.png" alt="" className="h-4 w-4 object-contain" />
              ) : sourceType === 'upload' ? <FileVideo size={14} /> : <Youtube size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-main truncate">
                {videoTitle ?? videoUrl ?? ''}
              </p>
            </div>
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
          {/* Left – Video + Transcript */}
          <div className={cn(
            'flex-1 flex flex-col overflow-hidden transition-opacity duration-300',
            activeView === 'video' ? 'opacity-100' : 'opacity-0 lg:opacity-100',
          )}>
            {/* Video 16:9, max 55vh */}
            <div className="w-full bg-black shrink-0" style={{ aspectRatio: '16 / 9', maxHeight: '55vh' }}>
              {sourceType === 'youtube' && videoId && (
                <iframe
                  id="youtube-player"
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              )}
              {sourceType === 'bilibili' && bilibiliVideo && (
                <iframe
                  key={`${bilibiliVideo.key}-${bilibiliSeekNonce}`}
                  src={buildBilibiliPlayerUrl(bilibiliVideo, bilibiliStartSeconds)}
                  title="Bilibili video player"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              )}
              {sourceType === 'upload' && playbackUrl && (
                <video ref={uploadedVideoRef} src={playbackUrl} controls preload="metadata" className="h-full w-full bg-black" />
              )}
            </div>

            {/* Transcript / Subtitles */}
            <div className="flex-1 flex flex-col overflow-hidden border-t border-[var(--border-color)]">
              {/* Tab bar */}
              <div className="flex items-center justify-between px-5 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-sidebar)]">
                <div className="flex items-center gap-1">
                  {(['transcript', 'subtitles'] as const).map(view => (
                    <button
                      key={view}
                      onClick={() => {
                        setCenterView(view);
                        if (view === 'subtitles') loadSubtitlesOnDemand();
                      }}
                      className={cn(
                        'px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] border-b-2 transition-colors',
                        centerView === view
                          ? 'border-[var(--primary)] text-[var(--primary)]'
                          : 'border-transparent text-text-muted hover:text-text-main',
                      )}
                    >
                      {view === 'transcript' ? 'Transcript' : 'Subtitles'}
                    </button>
                  ))}
                </div>
                {centerView === 'transcript' && transcript && (
                  <div className="flex items-center gap-1">
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
                    <button onClick={refreshTranscript} disabled={isLoadingTranscript} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
                      <RotateCcw size={11} className={isLoadingTranscript ? 'animate-spin' : ''} /> Refresh
                    </button>
                  </div>
                )}
                {centerView === 'transcript' && !transcript && transcriptError && (
                  <button onClick={refreshTranscript} disabled={isLoadingTranscript} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
                    <RotateCcw size={11} className={isLoadingTranscript ? 'animate-spin' : ''} /> Refresh
                  </button>
                )}
                {centerView === 'subtitles' && (subtitles || subtitlesError) && (
                  <button onClick={refreshSubtitles} disabled={isLoadingSubtitles} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
                    <RotateCcw size={11} className={isLoadingSubtitles ? 'animate-spin' : ''} /> Refresh
                  </button>
                )}
              </div>

              {/* Transcript view */}
              <div ref={transcriptRef} className={cn('flex-1 overflow-y-auto select-text', centerView !== 'transcript' && 'hidden')} onMouseUp={handleTranscriptMouseUp}>
                {isLoadingTranscript ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
                    <p className="text-xs text-zinc-400">Fetching captions…</p>
                  </div>
                ) : transcript ? (
                  <div className="divide-y divide-[var(--border-color)]">
                    {transcript.map((chunk, i) => {
                      const totalSec = Math.floor(chunk.startSeconds);
                      const label = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
                      return (
                        <button
                          key={i}
                          onClick={() => seekTo(chunk.startSeconds)}
                          className="w-full flex items-start gap-3 px-5 py-2.5 text-left hover:bg-[var(--primary)]/5 transition-colors group"
                        >
                          <span className="shrink-0 mt-0.5 min-w-[2.75rem] rounded-md bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                            {label}
                          </span>
                          <span className="text-xs text-text-main leading-relaxed">{chunk.text}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : transcriptError ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-main">Captions unavailable</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{transcriptError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
                    <p className="text-xs text-zinc-400">Loading transcript…</p>
                  </div>
                )}
              </div>

              {/* Subtitles view */}
              <div className={cn('flex-1 overflow-y-auto select-text', centerView !== 'subtitles' && 'hidden')}>
                {isLoadingSubtitles ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
                    <p className="text-xs text-zinc-400">Fetching subtitles…</p>
                  </div>
                ) : subtitles ? (
                  <div className="divide-y divide-[var(--border-color)]">
                    {subtitles.map((line, i) => {
                      const totalSec = Math.floor(line.startSeconds);
                      const label = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
                      return (
                        <button
                          key={i}
                          onClick={() => seekTo(line.startSeconds)}
                          className="w-full flex items-start gap-3 px-5 py-2 text-left hover:bg-[var(--primary)]/5 transition-colors group"
                        >
                          <span className="shrink-0 mt-0.5 min-w-[2.75rem] rounded-md bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                            {label}
                          </span>
                          <span className="text-xs text-text-main leading-relaxed">{line.text}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : subtitlesError ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-main">Subtitles unavailable</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{subtitlesError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                    <p className="text-xs text-zinc-400">Click Subtitles to load the original caption lines.</p>
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
          <button onClick={() => setActiveView('video')} className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'video' ? 'text-[var(--primary)]' : 'text-text-muted')}>
            <Youtube size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">Video</span>
          </button>
        </div>
      </motion.div>

      {/* Summary text selection toolbar */}
      {summaryToolbar && (
        <TextSelectionToolbar
          x={summaryToolbar.x}
          y={summaryToolbar.y}
          selectedText={summaryToolbar.text}
          onClose={() => setSummaryToolbar(null)}
          onAddNoteText={(text) => {
            noteEditorRef.current?.appendContent(`<p>${text}</p>`);
            setActiveTab('notes');
            setActiveView('study');
            setSummaryToolbar(null);
          }}
          onAskAI={(text) => {
            chatPanelRef.current?.setInput(text);
            setActiveTab('chat');
            setActiveView('study');
            setSummaryToolbar(null);
          }}
        />
      )}

      {/* Transcript text selection toolbar */}
      {transcriptToolbar && (
        <TextSelectionToolbar
          x={transcriptToolbar.x}
          y={transcriptToolbar.y}
          selectedText={transcriptToolbar.text}
          onClose={() => setTranscriptToolbar(null)}
          onAddNoteText={(text) => {
            noteEditorRef.current?.appendContent(`<p>${text}</p>`);
            setActiveTab('notes');
            setActiveView('study');
            setTranscriptToolbar(null);
          }}
          onAskAI={(text) => {
            chatPanelRef.current?.setInput(text);
            setActiveTab('chat');
            setActiveView('study');
            setTranscriptToolbar(null);
          }}
        />
      )}

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={videoTitle ?? videoUrl ?? 'YouTube Video'}
        summary={summary}
        mindMapText={mindMapText}
        notesHtml={noteContent || null}
        sourceType={sourceType}
        sourceUrl={sourceType === 'upload' && id ? `video/${id}` : videoUrl}
        fetchQuizzes={id && hasGeneratedQuizzes ? async () => {
          const qs = await videoService.getQuiz(id);
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

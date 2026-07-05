import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Files, FileVideo, ClipboardPaste, Wand2 } from 'lucide-react';
import { CONTENT_TYPE_ICONS } from '../constants/contentTypeIcons';
import { BulkUploadSection } from '../components/common/BulkUploadSection';
import { cn } from '../utils/cn';
import { CoursePicker } from '../components/common/CoursePicker';
import { DocumentTab } from '../components/summarizer/DocumentTab';
import { UploadVideoTab } from '../components/summarizer/UploadVideoTab';
import { AudioTab } from '../components/summarizer/AudioTab';
import { PodcastTab } from '../components/summarizer/PodcastTab';
import { WebTab } from '../components/summarizer/WebTab';
import { PasteTextTab } from '../components/summarizer/PasteTextTab';
import { WebVideoTab } from '../components/summarizer/WebVideoTab';
import { isExternalVideoSource } from '../constants/videoSources';

type Tab = 'document' | 'video' | 'web' | 'audio' | 'text';
type DocSubTab = 'single' | 'bulk';
type AudioSubTab = 'lecture' | 'podcast';
type VideoSubTab = 'link' | 'upload';

export const AISummarizerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    if (t === 'youtube' || t === 'bilibili' || t === 'video' || t === 'upload-video' || t === 'link' || isExternalVideoSource(t)) return 'video';
    if (t === 'web') return 'web';
    if (t === 'audio' || t === 'podcast') return 'audio';
    if (t === 'text' || t === 'paste') return 'text';
    return 'document';
  });
  const [docSubTab, setDocSubTab] = useState<DocSubTab>(() =>
    searchParams.get('tab') === 'bulk' ? 'bulk' : 'single',
  );
  // Podcast is the leading sub-tab; explicit ?tab=audio deep-links (e.g. from
  // the library) still land on the lecture upload.
  const [audioSubTab, setAudioSubTab] = useState<AudioSubTab>(() =>
    searchParams.get('tab') === 'audio' ? 'lecture' : 'podcast',
  );
  const [videoSubTab, setVideoSubTab] = useState<VideoSubTab>(() => {
    const t = searchParams.get('tab');
    if (t === 'upload-video') return 'upload';
    return 'link';
  });
  const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('courseId') ?? '');
  const [courseError, setCourseError] = useState(false);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCourseError(false);
  };

  return (
    <div className="flex h-full overflow-hidden px-4 sm:px-6">
      <div className="w-full mx-auto flex flex-col md:flex-row gap-3 md:gap-8 h-full">

        {/* Top (mobile) / Left (desktop) — Course Picker */}
        <div className="shrink-0 flex flex-col h-[270px] sm:h-[300px] md:h-full overflow-hidden md:w-[214px]">
          <CoursePicker
            selectedCourseId={selectedCourseId}
            onSelect={(id) => { setSelectedCourseId(id); setCourseError(false); }}
            error={courseError}
            variant="primary"
          />
        </div>

        {/* Right — Header + Tabs + Form */}
        <div className="flex-1 flex flex-col gap-4 md:gap-5 min-w-0 overflow-y-auto pb-4 md:pb-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-text-main">
            Turn anything into <span className="text-primary">study material</span>
          </h1>

          {/* Main Tabs */}
          <div className="flex rounded-xl bg-zinc-100 p-1 gap-1">
            <button
              onClick={() => handleTabChange('document')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all duration-200 whitespace-nowrap',
                activeTab === 'document' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              <Upload size={13} className="sm:hidden" /><Upload size={15} className="hidden sm:block" /> Document
            </button>
            <button
              onClick={() => handleTabChange('video')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all duration-200 whitespace-nowrap',
                activeTab === 'video' ? 'bg-white text-red-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              <CONTENT_TYPE_ICONS.video.icon size={13} className="sm:hidden" /><CONTENT_TYPE_ICONS.video.icon size={15} className="hidden sm:block" /> Video
            </button>
            <button
              onClick={() => handleTabChange('web')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all duration-200 whitespace-nowrap',
                activeTab === 'web' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              <CONTENT_TYPE_ICONS.article.icon size={13} className="sm:hidden" /><CONTENT_TYPE_ICONS.article.icon size={15} className="hidden sm:block" />
              <span className="hidden sm:inline">Web Article</span><span className="sm:hidden">Web</span>
            </button>
            <button
              onClick={() => handleTabChange('audio')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all duration-200 whitespace-nowrap',
                activeTab === 'audio'
                  ? audioSubTab === 'podcast' ? 'bg-white text-amber-500 shadow-sm' : 'bg-white text-primary shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {activeTab === 'audio' && audioSubTab === 'podcast'
                ? <><CONTENT_TYPE_ICONS.podcast.icon size={13} className="sm:hidden" /><CONTENT_TYPE_ICONS.podcast.icon size={15} className="hidden sm:block" /></>
                : <><CONTENT_TYPE_ICONS.audio.icon size={13} className="sm:hidden" /><CONTENT_TYPE_ICONS.audio.icon size={15} className="hidden sm:block" /></>}
              Audio
            </button>
            <button
              onClick={() => handleTabChange('text')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 sm:gap-2 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all duration-200 whitespace-nowrap',
                activeTab === 'text' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              <ClipboardPaste size={13} className="sm:hidden" /><ClipboardPaste size={15} className="hidden sm:block" />
              <span className="hidden sm:inline">Paste Text</span><span className="sm:hidden">Text</span>
            </button>
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {activeTab === 'document' && (
              <motion.div key="document" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
                <div className="flex rounded-lg bg-zinc-50 border border-zinc-200 p-0.5 gap-0.5 self-start">
                  <button
                    onClick={() => setDocSubTab('single')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200',
                      docSubTab === 'single' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                    )}
                  >
                    <Upload size={12} /> Upload
                  </button>
                  <button
                    onClick={() => setDocSubTab('bulk')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200',
                      docSubTab === 'bulk' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                    )}
                  >
                    <Files size={12} /> Batch Upload
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {docSubTab === 'single' ? (
                    <motion.div key="single" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                      <DocumentTab selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
                    </motion.div>
                  ) : (
                    <motion.div key="bulk" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                      <BulkUploadSection selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'video' && (
              <motion.div key="video" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
                <div className="flex flex-wrap rounded-lg bg-zinc-50 border border-zinc-200 p-0.5 gap-0.5 self-start">
                  <button
                    onClick={() => setVideoSubTab('link')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200',
                      videoSubTab === 'link' ? 'bg-white text-violet-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                    )}
                  >
                    <Wand2 size={12} /> Video Link
                  </button>
                  <button
                    onClick={() => setVideoSubTab('upload')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200',
                      videoSubTab === 'upload' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                    )}
                  >
                    <FileVideo size={12} /> Upload Video
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {videoSubTab === 'link' ? (
                    <motion.div key="link" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                      <WebVideoTab selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
                    </motion.div>
                  ) : (
                    <motion.div key="upload-video" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                      <UploadVideoTab selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'web' && (
              <motion.div key="web" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                <WebTab selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
              </motion.div>
            )}

            {activeTab === 'audio' && (
              <motion.div key="audio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
                <div className="flex rounded-lg bg-zinc-50 border border-zinc-200 p-0.5 gap-0.5 self-start">
                  <button
                    onClick={() => setAudioSubTab('podcast')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200',
                      audioSubTab === 'podcast' ? 'bg-white text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                    )}
                  >
                    <CONTENT_TYPE_ICONS.podcast.icon size={12} /> Podcast
                  </button>
                  <button
                    onClick={() => setAudioSubTab('lecture')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200',
                      audioSubTab === 'lecture' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                    )}
                  >
                    <CONTENT_TYPE_ICONS.audio.icon size={12} /> Audio Lecture
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {audioSubTab === 'lecture' ? (
                    <motion.div key="lecture" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                      <AudioTab selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
                    </motion.div>
                  ) : (
                    <motion.div key="podcast" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                      <PodcastTab selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'text' && (
              <motion.div key="text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                <PasteTextTab selectedCourseId={selectedCourseId} onCourseError={setCourseError} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};

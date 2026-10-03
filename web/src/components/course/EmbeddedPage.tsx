import React from 'react';
import { BookOpen } from 'lucide-react';
import { DocumentDetailsPage } from '../../pages/DocumentDetailsPage';
import { VideoDetailPage } from '../../pages/VideoDetailPage';
import { AudioDetailPage } from '../../pages/AudioDetailPage';
import { ArticlePage } from '../../pages/ArticlePage';
import { CourseStudySelected } from './CourseArtifactsWorkspace';

/** Renders the right-hand detail view for whatever material is selected in the course. */
export const EmbeddedPage: React.FC<{ selected: CourseStudySelected }> = ({ selected }) => {
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6 h-full">
        <div className="rounded-2xl bg-[var(--primary)]/10 p-6">
          <BookOpen size={40} className="text-[var(--primary)]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-main">No material selected</h3>
          <p className="text-xs text-text-muted mt-1">Pick a document or video from the left panel</p>
        </div>
      </div>
    );
  }

  if (selected.kind === 'video') {
    return <VideoDetailPage key={selected.data.id} embedded id={selected.data.id} />;
  }

  const doc = selected.data;

  if (doc.type === 'audio' || doc.type === 'podcast') {
    return <AudioDetailPage key={doc.id} embedded id={doc.id} courseId={doc.courseId} />;
  }

  if (doc.originalUrl) {
    return <ArticlePage key={doc.id} embedded id={doc.id} courseId={doc.courseId} />;
  }

  return <DocumentDetailsPage key={doc.id} embedded id={doc.id} initialDoc={doc} />;
};

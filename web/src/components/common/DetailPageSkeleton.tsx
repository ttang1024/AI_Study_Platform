import React from 'react';
import { cn } from '../../utils/cn';

type DetailSkeletonVariant = 'document' | 'article' | 'youtube' | 'audio';

interface DetailPageSkeletonProps {
  variant: DetailSkeletonVariant;
  embedded?: boolean;
}

const SkeletonBlock: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <div className={cn('animate-pulse rounded-md bg-zinc-200/80', className)} style={style} />
);

const HeaderSkeleton: React.FC<{ variant: DetailSkeletonVariant }> = ({ variant }) => (
  <div className="flex h-14 items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 shrink-0">
    <SkeletonBlock className="h-8 w-10" />
    <SkeletonBlock className={cn('h-7 w-7 rounded-lg', variant === 'youtube' && 'bg-red-200/80', variant === 'audio' && 'bg-primary/20')} />
    <div className="min-w-0 flex-1">
      <SkeletonBlock className="h-3.5 w-2/3 max-w-sm" />
    </div>
    <SkeletonBlock className="h-8 w-20 rounded-lg" />
  </div>
);

const StudyPanelSkeleton: React.FC = () => (
  <div className="hidden flex-1 border-l border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:flex lg:flex-col">
    <div className="flex h-[57px] items-center gap-3 border-b border-[var(--border-color)] px-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <SkeletonBlock className="h-4 w-4 rounded" />
          <SkeletonBlock className="h-2 w-10" />
        </div>
      ))}
    </div>
    <div className="flex-1 space-y-4 p-6">
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-11/12" />
      <SkeletonBlock className="h-3 w-4/5" />
      <div className="pt-4 space-y-3">
        <SkeletonBlock className="h-24 w-full rounded-xl" />
        <SkeletonBlock className="h-24 w-full rounded-xl" />
      </div>
    </div>
  </div>
);

const DocumentSkeleton: React.FC = () => (
  <div className="h-full overflow-hidden bg-zinc-100 p-4">
    <div className="mx-auto h-full max-w-3xl rounded-lg bg-white p-8 shadow-sm">
      <SkeletonBlock className="mb-8 h-5 w-2/3" />
      {Array.from({ length: 12 }).map((_, i) => (
        <SkeletonBlock key={i} className={cn('mb-4 h-3', i % 4 === 0 ? 'w-5/6' : i % 4 === 1 ? 'w-full' : i % 4 === 2 ? 'w-11/12' : 'w-3/4')} />
      ))}
    </div>
  </div>
);

export const ArticleReaderSkeleton: React.FC = () => (
  <div className="h-full overflow-y-auto bg-[var(--bg-app)]">
    <div className="mx-auto max-w-2xl px-8 py-10 pb-20">
      <SkeletonBlock className="mb-3 h-7 w-4/5" />
      <div className="mb-8 flex items-center gap-2 border-b border-[var(--border-color)] pb-4">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3 w-32" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonBlock key={i} className={cn('h-3.5', i % 5 === 0 ? 'w-5/6' : i % 5 === 1 ? 'w-full' : i % 5 === 2 ? 'w-11/12' : i % 5 === 3 ? 'w-4/5' : 'w-2/3')} />
        ))}
      </div>
    </div>
  </div>
);

const YouTubeSkeleton: React.FC = () => (
  <div className="flex h-full flex-col overflow-hidden">
    <SkeletonBlock className="w-full rounded-none bg-zinc-300" style={{ aspectRatio: '16 / 9', maxHeight: '55vh' } as React.CSSProperties} />
    <div className="flex flex-1 flex-col overflow-hidden border-t border-[var(--border-color)]">
      <div className="flex h-11 items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-5">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      <TranscriptRowsSkeleton />
    </div>
  </div>
);

const AudioSkeleton: React.FC = () => (
  <div className="flex h-full flex-col overflow-hidden">
    <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
      <div className="mb-4 flex items-center gap-4">
        <SkeletonBlock className="h-12 w-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-3 w-28" />
        </div>
      </div>
      <SkeletonBlock className="h-10 w-full rounded-xl" />
    </div>
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-11 items-center border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-5">
        <SkeletonBlock className="h-3 w-24" />
      </div>
      <TranscriptRowsSkeleton />
    </div>
  </div>
);

const TranscriptRowsSkeleton: React.FC = () => (
  <div className="flex-1 divide-y divide-[var(--border-color)] overflow-hidden">
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className="flex gap-3 px-5 py-3">
        <SkeletonBlock className="mt-0.5 h-5 w-11 shrink-0" />
        <SkeletonBlock className={cn('h-3.5 flex-1', i % 3 === 0 && 'max-w-[80%]', i % 3 === 1 && 'max-w-[92%]')} />
      </div>
    ))}
  </div>
);

export const DetailPageSkeleton: React.FC<DetailPageSkeletonProps> = ({ variant, embedded }) => {
  const leftPanel = {
    document: <DocumentSkeleton />,
    article: <ArticleReaderSkeleton />,
    youtube: <YouTubeSkeleton />,
    audio: <AudioSkeleton />,
  }[variant];

  return (
    <div className={cn('flex flex-col bg-[var(--bg-app)] overflow-hidden', embedded ? 'h-full' : 'h-screen')}>
      {!embedded && <HeaderSkeleton variant={variant} />}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">{leftPanel}</div>
        <StudyPanelSkeleton />
      </div>
      <div className="flex h-16 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:hidden shrink-0">
        <div className="flex flex-1 items-center justify-center"><SkeletonBlock className="h-7 w-14" /></div>
        <div className="flex flex-1 items-center justify-center"><SkeletonBlock className="h-7 w-16" /></div>
      </div>
    </div>
  );
};

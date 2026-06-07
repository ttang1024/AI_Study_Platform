import React from 'react';
import { cn } from '../../utils/cn';
import { parseTranscript, formatTime } from './transcript';

interface SegmentedTranscriptProps {
  transcript: string;
  currentTime: number;
  activeSegmentRef: React.RefObject<HTMLDivElement | null>;
  onSeek: (time: number) => void;
}

export const SegmentedTranscript: React.FC<SegmentedTranscriptProps> = ({
  transcript, currentTime, activeSegmentRef, onSeek,
}) => {
  const segments = parseTranscript(transcript);

  // Plain text fallback (old transcripts stored without timestamps)
  if (!segments) {
    return (
      <div className="px-6 py-5">
        <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap select-text">{transcript}</p>
      </div>
    );
  }

  let activeIdx = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (currentTime >= segments[i].start) {
      activeIdx = i;
      break;
    }
  }

  return (
    <div className="flex flex-col divide-y divide-[var(--border-color)]">
      {segments.map((seg, i) => {
        const isActive = i === activeIdx;
        return (
          <div
            key={i}
            ref={isActive ? activeSegmentRef : undefined}
            onClick={() => onSeek(seg.start)}
            className={cn(
              'flex gap-3 px-5 py-3.5 cursor-pointer transition-colors duration-150 group',
              isActive
                ? 'bg-[var(--primary)]/8'
                : 'hover:bg-zinc-50',
            )}
          >
            <span className={cn(
              'shrink-0 mt-0.5 text-[11px] font-mono font-bold tabular-nums pt-px',
              isActive ? 'text-[var(--primary)]' : 'text-text-muted group-hover:text-text-main',
            )}>
              {formatTime(seg.start)}
            </span>
            <p className={cn(
              'text-sm leading-relaxed select-text',
              isActive ? 'text-text-main font-medium' : 'text-text-muted group-hover:text-text-main',
            )}>
              {seg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
};

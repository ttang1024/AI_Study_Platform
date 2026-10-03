import React, { useRef } from 'react';
import type { Markmap } from 'markmap-view';
import { MarkmapRenderer } from '../../components/mindmap/MarkmapRenderer';

/** Fixed-height mind map for the public share page — no zoom controls, no StudyContext. */
export const MarkmapView: React.FC<{ text: string }> = ({ text }) => {
  const mmRef = useRef<Markmap | null>(null);
  return (
    <div className="w-full" style={{ height: '420px' }}>
      <MarkmapRenderer text={text} mmRef={mmRef} />
    </div>
  );
};

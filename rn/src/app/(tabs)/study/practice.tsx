import React from 'react';

import { PracticeReport } from '@/components/practice/PracticeReport';
import { PracticeRunner } from '@/components/practice/PracticeRunner';
import { PracticeSetup } from '@/components/practice/PracticeSetup';
import { usePractice } from '@/hooks/usePractice';

export default function PracticeScreen() {
  const p = usePractice();

  if (p.phase === 'setup') {
    return (
      <PracticeSetup
        courses={p.courses}
        count={p.count}
        setCount={p.setCount}
        sources={p.sources}
        toggleSource={p.toggleSource}
        courseId={p.courseId}
        setCourseId={p.setCourseId}
        loading={p.loading}
        smartLoading={p.smartLoading}
        error={p.error}
        start={p.start}
        startSmartSession={p.startSmartSession}
      />
    );
  }

  if (p.phase === 'report') {
    return (
      <PracticeReport
        summary={p.summary}
        results={p.results}
        questions={p.questions}
        elapsed={p.elapsed}
        restart={p.restart}
      />
    );
  }

  return (
    <PracticeRunner
      current={p.current}
      index={p.index}
      questions={p.questions}
      selected={p.selected}
      revealed={p.revealed}
      elapsed={p.elapsed}
      graded={p.graded}
      isLast={p.isLast}
      pickOption={p.pickOption}
      grade={p.grade}
      reveal={p.reveal}
      next={p.next}
    />
  );
}

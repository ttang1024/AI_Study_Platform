import React from 'react';

import { QuizRunner } from '@/components/quiz/QuizRunner';
import { mapQuiz } from '@core/services/documentService';
import { videoService } from '@/services/videoService';

interface VideoQuizSectionProps {
  videoId: string;
  videoUrl: string;
}

export const VideoQuizSection: React.FC<VideoQuizSectionProps> = ({ videoId, videoUrl }) => (
  <QuizRunner
    getQuiz={(difficulty) => videoService.getQuiz(videoId, difficulty).then((qs) => qs.map(mapQuiz))}
    generateQuiz={(difficulty) => videoService.generateQuiz(videoId, videoUrl, difficulty).then((qs) => qs.map(mapQuiz))}
    submitQuiz={(answers, score, total, confidence) =>
      videoService.submitQuiz(videoId, answers, score, total, confidence)}
  />
);

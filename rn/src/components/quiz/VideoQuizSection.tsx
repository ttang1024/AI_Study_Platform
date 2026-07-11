import React from 'react';

import { QuizRunner } from '@/components/quiz/QuizRunner';
import { quizService } from '@/services/quizService';

interface VideoQuizSectionProps {
  videoId: string;
  videoUrl: string;
}

export const VideoQuizSection: React.FC<VideoQuizSectionProps> = ({ videoId, videoUrl }) => (
  <QuizRunner
    getQuiz={(difficulty) => quizService.getVideoQuiz(videoId, difficulty)}
    generateQuiz={(difficulty) => quizService.generateForVideo(videoId, videoUrl, difficulty)}
    submitQuiz={(answers, score, total) => quizService.submitVideoQuiz(videoId, answers, score, total)}
  />
);
